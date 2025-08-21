import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Dimensions,
  StatusBar,
  Share,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { theme } from '@/constants/theme';
import MascotAvatar from '@/components/ui/MascotAvatar';
import GradientButton from '@/components/ui/GradientButton';
import { SupabaseService } from '@/utils/supabaseService';

const { width = 375 } = Dimensions.get('window') || {};

interface BattleRoom {
  id: string;
  name: string;
  host_name: string;
  topic: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  bet_amount: number;
  current_players: number;
  max_players: number;
  status: 'waiting' | 'active' | 'completed';
  created_at: string;
  room_code: string;
}

interface PopularTopic {
  name: string;
  category: string;
  popularity: number;
  examRelevance: string;
}

export default function Battle() {
  const isMounted = useRef(true);
  const [activeTab, setActiveTab] = useState<'quick' | 'rooms' | 'create'>('quick');
  const [battleRooms, setBattleRooms] = useState<BattleRoom[]>([]);
  const [popularTopics, setPopularTopics] = useState<PopularTopic[]>([]);
  const [userCoins, setUserCoins] = useState({ balance: 5000, total_earned: 5000, total_spent: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Create room form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [betAmount, setBetAmount] = useState(100);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [isCreating, setIsCreating] = useState(false);
  
  // Join room form
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Animation values
  const fadeIn = useSharedValue(0);
  const headerScale = useSharedValue(0.9);
  const tabsOpacity = useSharedValue(0);
  const coinsAnim = useSharedValue(1);
  const battleGlow = useSharedValue(0);

  useEffect(() => {
    isMounted.current = true;
    loadBattleData();
    startAnimations();
    
    return () => {
      isMounted.current = false;
    };
  }, []);

  const startAnimations = () => {
    fadeIn.value = withTiming(1, { duration: 800 });
    headerScale.value = withSpring(1, { damping: 15, stiffness: 100 });
    tabsOpacity.value = withDelay(300, withTiming(1, { duration: 600 }));
    
    // Coins animation
    coinsAnim.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
    
    // Battle glow
    battleGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  };

  const loadBattleData = async () => {
    try {
      if (!isMounted.current) return;
      
      const user = await SupabaseService.getCurrentUser();
      if (!user) {
        if (!isMounted.current) return;
        router.replace('/auth');
        return;
      }

      // Load real data from database
      const [roomsData, coinsData, topicsData] = await Promise.allSettled([
        SupabaseService.getBattleRooms(),
        SupabaseService.getUserCoins(user.id),
        SupabaseService.getPopularTopics(),
      ]);

      if (!isMounted.current) return;

      // Set battle rooms
      if (roomsData.status === 'fulfilled') {
        setBattleRooms(roomsData.value || []);
      }

      // Set user coins with fallback
      if (coinsData.status === 'fulfilled' && coinsData.value) {
        setUserCoins(coinsData.value);
      } else {
        // Fallback coins if API fails
        setUserCoins({ balance: 5000, total_earned: 5000, total_spent: 0 });
      }

      // Set popular topics
      if (topicsData.status === 'fulfilled') {
        setPopularTopics(topicsData.value || []);
      }

    } catch (error) {
      console.error('Error loading battle data:', error);
      if (!isMounted.current) return;
      // Set fallback data
      setUserCoins({ balance: 5000, total_earned: 5000, total_spent: 0 });
      setBattleRooms([]);
      setPopularTopics([]);
    } finally {
      if (!isMounted.current) return;
      setIsLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBattleData().finally(() => {
      if (isMounted.current) {
        setRefreshing(false);
      }
    });
  };

  const handleQuickBattle = async () => {
    try {
      const user = await SupabaseService.getCurrentUser();
      if (!user) {
        router.replace('/auth');
        return;
      }

      // Check if user has enough coins
      if (userCoins.balance < 100) {
        Alert.alert(
          'Insufficient Coins',
          'You need at least 100 coins to start a battle. Complete daily quizzes to earn more coins!',
          [{ text: 'OK' }]
        );
        return;
      }

      // Find or create quick battle
      const result = await SupabaseService.findOrCreateQuickBattle({
        topic_id: null,
        subject_name: 'General Knowledge',
        difficulty: 'medium',
        bet_amount: 100,
      });

      if (result.battleRoom) {
        router.push({
          pathname: '/battle/room',
          params: { roomId: result.battleRoom.id },
        });
      }
    } catch (error) {
      console.error('Error starting quick battle:', error);
      Alert.alert('Error', 'Failed to start battle. Please try again.');
    }
  };

  const handleCreateRoom = async () => {
    try {
      if (!selectedTopic && !customTopic) {
        Alert.alert('Missing Topic', 'Please select or enter a topic for the battle.');
        return;
      }

      if (userCoins.balance < betAmount) {
        Alert.alert('Insufficient Coins', `You need ${betAmount} coins to create this battle.`);
        return;
      }

      setIsCreating(true);

      const roomData = {
        room_name: customTopic || selectedTopic,
        subject_name: selectedTopic,
        difficulty: selectedDifficulty,
        bet_amount: betAmount,
        max_participants: maxPlayers,
      };

      const result = await SupabaseService.createBattleRoom(roomData);

      if (result.battleRoom) {
        setShowCreateModal(false);
        router.push({
          pathname: '/battle/room',
          params: { roomId: result.battleRoom.id },
        });
      }
    } catch (error) {
      console.error('Error creating battle room:', error);
      Alert.alert('Error', 'Failed to create battle room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    try {
      if (!roomCode.trim()) {
        Alert.alert('Missing Code', 'Please enter a room code to join.');
        return;
      }

      setIsJoining(true);

      const result = await SupabaseService.joinBattleRoom(roomCode.trim().toUpperCase());

      if (result.success) {
        setShowJoinModal(false);
        setRoomCode('');
        router.push({
          pathname: '/battle/room',
          params: { roomId: result.battleRoom.id },
        });
      }
    } catch (error) {
      console.error('Error joining battle room:', error);
      Alert.alert('Error', error.message || 'Failed to join battle room.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleTopicSelect = (topic: PopularTopic) => {
    setSelectedTopic(topic.name);
    setCustomTopic('');
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ translateY: interpolate(fadeIn.value, [0, 1], [30, 0]) }],
  }));

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: headerScale.value }],
  }));

  const tabsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: tabsOpacity.value,
  }));

  const coinsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coinsAnim.value }],
  }));

  const battleGlowAnimatedStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.3 + battleGlow.value * 0.4,
    shadowRadius: 20 + battleGlow.value * 30,
  }));

  if (isLoading) {
    return (
      <LinearGradient
        colors={[
          theme.colors.background.primary,
          theme.colors.background.secondary,
        ]}
        style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <MascotAvatar size={80} animated={true} glowing={true} mood="excited" />
          <Text style={styles.loadingText}>Loading battle arena...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[
        theme.colors.background.primary,
        theme.colors.background.secondary,
        theme.colors.background.tertiary,
      ]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Enhanced Header */}
        <Animated.View style={[styles.header, headerAnimatedStyle]}>
          <View style={styles.headerContent}>
            <LinearGradient
              colors={[theme.colors.accent.pink, theme.colors.accent.purple]}
              style={styles.headerIcon}
            >
              <FontAwesome5 name="fist-raised" size={24} color={theme.colors.text.primary} solid />
            </LinearGradient>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Battle Arena</Text>
              <Text style={styles.headerSubtitle}>Challenge friends & earn coins</Text>
            </View>
          </View>
          
          <Animated.View style={[styles.coinsContainer, coinsAnimatedStyle]}>
            <FontAwesome5 name="coins" size={20} color={theme.colors.accent.gold} />
            <Text style={styles.coinsText}>{(userCoins?.balance || 0).toLocaleString()}</Text>
          </Animated.View>
        </Animated.View>

        {/* Enhanced Tab Navigation */}
        <Animated.View style={[styles.tabsContainer, tabsAnimatedStyle]}>
          <View style={styles.tabsRow}>
            <TabButton
              title="Quick Battle"
              icon="bolt"
              isActive={activeTab === 'quick'}
              onPress={() => setActiveTab('quick')}
              color={theme.colors.accent.yellow}
            />
            <TabButton
              title="Battle Rooms"
              icon="users"
              isActive={activeTab === 'rooms'}
              onPress={() => setActiveTab('rooms')}
              color={theme.colors.accent.blue}
            />
            <TabButton
              title="Create Room"
              icon="plus-circle"
              isActive={activeTab === 'create'}
              onPress={() => setActiveTab('create')}
              color={theme.colors.accent.green}
            />
          </View>
        </Animated.View>

        {/* Content */}
        <Animated.View style={[styles.content, animatedStyle]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.colors.accent.purple]}
                tintColor={theme.colors.accent.purple}
              />
            }
            contentContainerStyle={styles.scrollContent}
          >
            {activeTab === 'quick' && (
              <QuickBattleTab
                popularTopics={popularTopics}
                onQuickBattle={handleQuickBattle}
                onJoinRoom={() => setShowJoinModal(true)}
                battleGlowStyle={battleGlowAnimatedStyle}
              />
            )}

            {activeTab === 'rooms' && (
              <BattleRoomsTab
                battleRooms={battleRooms}
                onJoinRoom={(room) => router.push({
                  pathname: '/battle/room',
                  params: { roomId: room.id },
                })}
                onRefresh={onRefresh}
              />
            )}

            {activeTab === 'create' && (
              <CreateRoomTab
                popularTopics={popularTopics}
                selectedTopic={selectedTopic}
                customTopic={customTopic}
                selectedDifficulty={selectedDifficulty}
                betAmount={betAmount}
                maxPlayers={maxPlayers}
                userCoins={userCoins}
                onTopicSelect={handleTopicSelect}
                onCustomTopicChange={setCustomTopic}
                onDifficultyChange={setSelectedDifficulty}
                onBetAmountChange={setBetAmount}
                onMaxPlayersChange={setMaxPlayers}
                onCreateRoom={handleCreateRoom}
                isCreating={isCreating}
              />
            )}
          </ScrollView>
        </Animated.View>

        {/* Join Room Modal */}
        <Modal visible={showJoinModal} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowJoinModal(false)}>
            <Pressable style={styles.joinModal} onPress={() => {}}>
              <LinearGradient
                colors={[theme.colors.background.card, theme.colors.background.secondary]}
                style={styles.joinModalContent}
              >
                <Text style={styles.joinModalTitle}>Join Battle Room</Text>
                
                <View style={styles.joinModalForm}>
                  <Text style={styles.joinModalLabel}>Room Code</Text>
                  <TextInput
                    style={styles.joinModalInput}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor={theme.colors.text.tertiary}
                    value={roomCode}
                    onChangeText={setRoomCode}
                    maxLength={6}
                    autoCapitalize="characters"
                  />
                </View>
                
                <View style={styles.joinModalActions}>
                  <TouchableOpacity
                    style={styles.joinModalCancel}
                    onPress={() => setShowJoinModal(false)}
                  >
                    <Text style={styles.joinModalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <GradientButton
                    title={isJoining ? "Joining..." : "Join Battle"}
                    onPress={handleJoinRoom}
                    size="medium"
                    disabled={isJoining || !roomCode.trim()}
                    colors={[theme.colors.accent.blue, theme.colors.accent.purple]}
                  />
                </View>
              </LinearGradient>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

function TabButton({ title, icon, isActive, onPress, color }: {
  title: string;
  icon: string;
  isActive: boolean;
  onPress: () => void;
  color: string;
}) {
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withSpring(1, { damping: 15, stiffness: 120 })
    );
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.tabButton, animatedStyle]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <LinearGradient
          colors={
            isActive
              ? [color + '30', color + '20']
              : [theme.colors.background.card, theme.colors.background.secondary]
          }
          style={styles.tabButtonGradient}
        >
          <FontAwesome5 
            name={icon} 
            size={18} 
            color={isActive ? color : theme.colors.text.tertiary} 
            solid={isActive}
          />
          <Text style={[
            styles.tabButtonText,
            { color: isActive ? color : theme.colors.text.secondary }
          ]}>
            {title}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

function QuickBattleTab({ popularTopics, onQuickBattle, onJoinRoom, battleGlowStyle }: {
  popularTopics: PopularTopic[];
  onQuickBattle: () => void;
  onJoinRoom: () => void;
  battleGlowStyle: any;
}) {
  return (
    <View style={styles.tabContent}>
      {/* Quick Battle Hero */}
      <View style={styles.quickBattleHero}>
        <MascotAvatar size={100} animated={true} glowing={true} mood="excited" />
        
        <LinearGradient
          colors={[theme.colors.accent.yellow, theme.colors.accent.green]}
          style={styles.heroBadge}
        >
          <FontAwesome5 name="bolt" size={24} color={theme.colors.text.primary} solid />
          <Text style={styles.heroTitle}>Quick Battle</Text>
        </LinearGradient>
        
        <Text style={styles.heroSubtitle}>
          Jump into instant battles with players across India!
        </Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Animated.View style={battleGlowStyle}>
          <GradientButton
            title="Start Quick Battle"
            onPress={onQuickBattle}
            size="large"
            fullWidth
            icon={<FontAwesome5 name="rocket" size={20} color={theme.colors.text.primary} solid />}
            colors={[theme.colors.accent.pink, theme.colors.accent.purple]}
            style={styles.quickBattleButton}
          />
        </Animated.View>
        
        <GradientButton
          title="Join with Code"
          onPress={onJoinRoom}
          size="large"
          fullWidth
          icon={<FontAwesome5 name="key" size={20} color={theme.colors.text.primary} solid />}
          colors={[theme.colors.accent.blue, theme.colors.accent.cyan]}
        />
      </View>

      {/* Popular Topics */}
      {popularTopics.length > 0 && (
        <View style={styles.popularTopicsSection}>
          <Text style={styles.sectionTitle}>
            <FontAwesome5 name="fire" size={18} color={theme.colors.accent.yellow} solid />
            {' '}Trending Battle Topics
          </Text>
          
          <View style={styles.topicsList}>
            {popularTopics.slice(0, 6).map((topic, index) => (
              <PopularTopicCard key={index} topic={topic} index={index} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function BattleRoomsTab({ battleRooms, onJoinRoom, onRefresh }: {
  battleRooms: BattleRoom[];
  onJoinRoom: (room: BattleRoom) => void;
  onRefresh: () => void;
}) {
  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>
        <FontAwesome5 name="users" size={18} color={theme.colors.accent.blue} solid />
        {' '}Active Battle Rooms
      </Text>
      
      {battleRooms.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome5 name="search" size={48} color={theme.colors.text.tertiary} />
          <Text style={styles.emptyStateText}>No active battle rooms</Text>
          <Text style={styles.emptyStateSubtext}>Create a room or try quick battle!</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <FontAwesome5 name="sync-alt" size={16} color={theme.colors.accent.blue} />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.roomsList}>
          {battleRooms.map((room, index) => (
            <BattleRoomCard
              key={room.id}
              room={room}
              index={index}
              onJoin={() => onJoinRoom(room)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function CreateRoomTab({ 
  popularTopics, 
  selectedTopic, 
  customTopic, 
  selectedDifficulty, 
  betAmount, 
  maxPlayers, 
  userCoins,
  onTopicSelect, 
  onCustomTopicChange, 
  onDifficultyChange, 
  onBetAmountChange, 
  onMaxPlayersChange, 
  onCreateRoom,
  isCreating 
}: {
  popularTopics: PopularTopic[];
  selectedTopic: string;
  customTopic: string;
  selectedDifficulty: 'easy' | 'medium' | 'hard';
  betAmount: number;
  maxPlayers: number;
  userCoins: any;
  onTopicSelect: (topic: PopularTopic) => void;
  onCustomTopicChange: (text: string) => void;
  onDifficultyChange: (difficulty: 'easy' | 'medium' | 'hard') => void;
  onBetAmountChange: (amount: number) => void;
  onMaxPlayersChange: (players: number) => void;
  onCreateRoom: () => void;
  isCreating: boolean;
}) {
  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>
        <FontAwesome5 name="plus-circle" size={18} color={theme.colors.accent.green} solid />
        {' '}Create Battle Room
      </Text>

      {/* Topic Selection */}
      <View style={styles.formSection}>
        <Text style={styles.formLabel}>Battle Topic</Text>
        
        {popularTopics.length > 0 && (
          <View style={styles.popularTopicsGrid}>
            {popularTopics.slice(0, 6).map((topic, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.topicChip,
                  selectedTopic === topic.name && styles.selectedTopicChip,
                ]}
                onPress={() => onTopicSelect(topic)}
              >
                <Text style={[
                  styles.topicChipText,
                  selectedTopic === topic.name && styles.selectedTopicChipText,
                ]}>
                  {topic.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        <TextInput
          style={styles.customTopicInput}
          placeholder="Or enter custom topic..."
          placeholderTextColor={theme.colors.text.tertiary}
          value={customTopic}
          onChangeText={onCustomTopicChange}
        />
      </View>

      {/* Difficulty Selection */}
      <View style={styles.formSection}>
        <Text style={styles.formLabel}>Difficulty</Text>
        <View style={styles.difficultyButtons}>
          {(['easy', 'medium', 'hard'] as const).map((difficulty) => (
            <TouchableOpacity
              key={difficulty}
              style={[
                styles.difficultyButton,
                selectedDifficulty === difficulty && styles.selectedDifficultyButton,
              ]}
              onPress={() => onDifficultyChange(difficulty)}
            >
              <Text style={[
                styles.difficultyButtonText,
                selectedDifficulty === difficulty && styles.selectedDifficultyButtonText,
              ]}>
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Bet Amount */}
      <View style={styles.formSection}>
        <Text style={styles.formLabel}>Bet Amount</Text>
        <View style={styles.betAmountContainer}>
          {[50, 100, 250, 500].map((amount) => (
            <TouchableOpacity
              key={amount}
              style={[
                styles.betAmountButton,
                betAmount === amount && styles.selectedBetAmountButton,
              ]}
              onPress={() => onBetAmountChange(amount)}
            >
              <FontAwesome5 name="coins" size={14} color={theme.colors.accent.gold} />
              <Text style={[
                styles.betAmountText,
                betAmount === amount && styles.selectedBetAmountText,
              ]}>
                {amount}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.balanceText}>
          Your balance: {userCoins.balance.toLocaleString()} coins
        </Text>
      </View>

      {/* Max Players */}
      <View style={styles.formSection}>
        <Text style={styles.formLabel}>Max Players</Text>
        <View style={styles.playersButtons}>
          {[2, 4, 6, 8].map((players) => (
            <TouchableOpacity
              key={players}
              style={[
                styles.playersButton,
                maxPlayers === players && styles.selectedPlayersButton,
              ]}
              onPress={() => onMaxPlayersChange(players)}
            >
              <Text style={[
                styles.playersButtonText,
                maxPlayers === players && styles.selectedPlayersButtonText,
              ]}>
                {players}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Create Button */}
      <View style={styles.createButtonContainer}>
        <GradientButton
          title={isCreating ? "Creating..." : "Create Battle Room"}
          onPress={onCreateRoom}
          size="large"
          fullWidth
          disabled={isCreating || (!selectedTopic && !customTopic) || userCoins.balance < betAmount}
          icon={<FontAwesome5 name="sword" size={20} color={theme.colors.text.primary} solid />}
          colors={[theme.colors.accent.green, theme.colors.accent.cyan]}
        />
      </View>
    </View>
  );
}

function PopularTopicCard({ topic, index }: {
  topic: PopularTopic;
  index: number;
}) {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    setTimeout(() => {
      opacity.value = withTiming(1, { duration: 400 });
      scale.value = withSpring(1, { damping: 15, stiffness: 100 });
    }, index * 100);
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'History': theme.colors.accent.purple,
      'Polity': theme.colors.accent.blue,
      'Geography': theme.colors.accent.green,
      'Economy': theme.colors.accent.yellow,
      'Science': theme.colors.accent.cyan,
      'Current Affairs': theme.colors.accent.pink,
    };
    return colors[category] || theme.colors.accent.purple;
  };

  return (
    <Animated.View style={[styles.popularTopicCard, animatedStyle]}>
      <LinearGradient
        colors={[getCategoryColor(topic.category) + '20', getCategoryColor(topic.category) + '10']}
        style={styles.popularTopicGradient}
      >
        <Text style={styles.popularTopicName}>{topic.name}</Text>
        <Text style={styles.popularTopicCategory}>{topic.category}</Text>
        
        <View style={styles.popularTopicMeta}>
          <View style={styles.popularityIndicator}>
            <FontAwesome5 name="fire" size={12} color={theme.colors.accent.yellow} solid />
            <Text style={styles.popularityText}>{topic.popularity}%</Text>
          </View>
          <Text style={styles.examRelevanceText}>{topic.examRelevance}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function BattleRoomCard({ room, index, onJoin }: {
  room: BattleRoom;
  index: number;
  onJoin: () => void;
}) {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    setTimeout(() => {
      opacity.value = withTiming(1, { duration: 400 });
      scale.value = withSpring(1, { damping: 15, stiffness: 100 });
    }, index * 150);
  }, [index]);

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withSpring(1, { damping: 15, stiffness: 120 })
    );
    onJoin();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return theme.colors.accent.green;
      case 'medium': return theme.colors.accent.yellow;
      case 'hard': return theme.colors.accent.pink;
      default: return theme.colors.accent.blue;
    }
  };

  return (
    <Animated.View style={[styles.battleRoomCard, animatedStyle]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <LinearGradient
          colors={[theme.colors.background.card, theme.colors.background.secondary]}
          style={styles.battleRoomGradient}
        >
          <View style={styles.roomHeader}>
            <Text style={styles.roomName}>{room.name}</Text>
            <View style={styles.roomMeta}>
              <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(room.difficulty) + '20' }]}>
                <Text style={[styles.difficultyText, { color: getDifficultyColor(room.difficulty) }]}>
                  {room.difficulty}
                </Text>
              </View>
            </View>
          </View>
          
          <Text style={styles.roomTopic}>{room.topic} • {room.subject}</Text>
          <Text style={styles.roomHost}>Host: {room.host_name}</Text>
          
          <View style={styles.roomStats}>
            <View style={styles.roomStat}>
              <FontAwesome5 name="users" size={14} color={theme.colors.accent.blue} />
              <Text style={styles.roomStatText}>
                {room.current_players}/{room.max_players}
              </Text>
            </View>
            
            <View style={styles.roomStat}>
              <FontAwesome5 name="coins" size={14} color={theme.colors.accent.gold} />
              <Text style={styles.roomStatText}>{room.bet_amount}</Text>
            </View>
            
            <View style={styles.roomStat}>
              <FontAwesome5 name="clock" size={14} color={theme.colors.accent.green} />
              <Text style={styles.roomStatText}>
                {Math.round((Date.now() - new Date(room.created_at).getTime()) / 60000)}m ago
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: theme.fonts.body,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.glow,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
  },
  coinsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.card,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  coinsText: {
    fontSize: 16,
    fontFamily: theme.fonts.heading,
    color: theme.colors.accent.gold,
  },
  tabsContainer: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  tabButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  tabButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border.tertiary,
    borderRadius: theme.borderRadius.md,
  },
  tabButtonText: {
    fontSize: 14,
    fontFamily: theme.fonts.subheading,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  tabContent: {
    paddingHorizontal: theme.spacing.lg,
  },
  quickBattleHero: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.md,
    ...theme.shadows.card,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: theme.fonts.body,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  quickActions: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  quickBattleButton: {
    shadowColor: theme.colors.accent.pink,
  },
  popularTopicsSection: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  topicsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  popularTopicCard: {
    width: '48%',
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  popularTopicGradient: {
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border.tertiary,
    borderRadius: theme.borderRadius.md,
  },
  popularTopicName: {
    fontSize: 14,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  popularTopicCategory: {
    fontSize: 12,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  popularTopicMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  popularityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  popularityText: {
    fontSize: 10,
    fontFamily: theme.fonts.caption,
    color: theme.colors.accent.yellow,
  },
  examRelevanceText: {
    fontSize: 10,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.tertiary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  emptyStateText: {
    fontSize: 18,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
  },
  emptyStateSubtext: {
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.md,
  },
  refreshButtonText: {
    fontSize: 14,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.accent.blue,
  },
  roomsList: {
    gap: theme.spacing.md,
  },
  battleRoomCard: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  battleRoomGradient: {
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    borderRadius: theme.borderRadius.lg,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  roomName: {
    fontSize: 18,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    flex: 1,
  },
  roomMeta: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  difficultyBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  difficultyText: {
    fontSize: 10,
    fontFamily: theme.fonts.caption,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  roomTopic: {
    fontSize: 16,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  roomHost: {
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing.md,
  },
  roomStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roomStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roomStatText: {
    fontSize: 12,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
  },
  formSection: {
    marginBottom: theme.spacing.xl,
  },
  formLabel: {
    fontSize: 16,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  popularTopicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  topicChip: {
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.tertiary,
  },
  selectedTopicChip: {
    backgroundColor: theme.colors.accent.purple + '20',
    borderColor: theme.colors.accent.purple,
  },
  topicChipText: {
    fontSize: 12,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
  },
  selectedTopicChipText: {
    color: theme.colors.accent.purple,
  },
  customTopicInput: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 16,
    fontFamily: theme.fonts.body,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.secondary,
  },
  difficultyButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  difficultyButton: {
    flex: 1,
    backgroundColor: theme.colors.background.tertiary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.tertiary,
  },
  selectedDifficultyButton: {
    backgroundColor: theme.colors.accent.blue + '20',
    borderColor: theme.colors.accent.blue,
  },
  difficultyButtonText: {
    fontSize: 14,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.secondary,
  },
  selectedDifficultyButtonText: {
    color: theme.colors.accent.blue,
  },
  betAmountContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  betAmountButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.tertiary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border.tertiary,
  },
  selectedBetAmountButton: {
    backgroundColor: theme.colors.accent.gold + '20',
    borderColor: theme.colors.accent.gold,
  },
  betAmountText: {
    fontSize: 14,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.secondary,
  },
  selectedBetAmountText: {
    color: theme.colors.accent.gold,
  },
  balanceText: {
    fontSize: 12,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
  },
  playersButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  playersButton: {
    flex: 1,
    backgroundColor: theme.colors.background.tertiary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.tertiary,
  },
  selectedPlayersButton: {
    backgroundColor: theme.colors.accent.green + '20',
    borderColor: theme.colors.accent.green,
  },
  playersButtonText: {
    fontSize: 14,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.secondary,
  },
  selectedPlayersButtonText: {
    color: theme.colors.accent.green,
  },
  createButtonContainer: {
    marginTop: theme.spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  joinModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  joinModalContent: {
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  joinModalTitle: {
    fontSize: 20,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  joinModalForm: {
    marginBottom: theme.spacing.lg,
  },
  joinModalLabel: {
    fontSize: 14,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  joinModalInput: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 18,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.secondary,
  },
  joinModalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  joinModalCancel: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  joinModalCancelText: {
    fontSize: 16,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.tertiary,
  },
});