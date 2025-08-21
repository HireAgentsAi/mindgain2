import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Dimensions,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
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

interface BattlePlayer {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string;
  score: number;
  current_question: number;
  is_ready: boolean;
  is_host: boolean;
  status: 'waiting' | 'ready' | 'playing' | 'finished';
  level: number;
  streak_days: number;
}

export default function BattleRoomScreen() {
  const isMounted = useRef(true);
  const params = useLocalSearchParams();
  const { roomId } = params;
  
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<BattlePlayer[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isHost, setIsHost] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Animation values
  const fadeIn = useSharedValue(0);
  const playersOpacity = useSharedValue(0);
  const countdownScale = useSharedValue(1);
  const readyPulse = useSharedValue(1);
  const battleGlow = useSharedValue(0);

  useEffect(() => {
    isMounted.current = true;
    loadBattleRoom();
    startAnimations();
    
    return () => {
      isMounted.current = false;
    };
  }, [roomId]);

  const startAnimations = () => {
    fadeIn.value = withTiming(1, { duration: 800 });
    playersOpacity.value = withDelay(300, withTiming(1, { duration: 600 }));
    
    // Ready pulse animation
    readyPulse.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
    
    // Battle glow effect
    battleGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  };

  const loadBattleRoom = async () => {
    try {
      if (!isMounted.current) return;
      
      const user = await SupabaseService.getCurrentUser();
      if (!user) {
        if (!isMounted.current) return;
        router.replace('/auth');
        return;
      }

      setCurrentUser(user);
      
      // Get real battle room data
      const battleRoomData = await SupabaseService.getBattleRoomDetails(roomId as string);
      
      if (!battleRoomData.room) {
        throw new Error('Battle room not found');
      }

      const realRoom = {
        id: battleRoomData.room.id,
        name: battleRoomData.room.name,
        topic: battleRoomData.room.subject_name || 'General Knowledge',
        subject: battleRoomData.room.subject_name || 'General',
        max_players: battleRoomData.room.max_participants,
        status: battleRoomData.room.status,
        host_id: battleRoomData.room.host_id,
        host_name: battleRoomData.room.profiles?.full_name || 'Host',
        created_at: battleRoomData.room.created_at,
      };

      // Get real players with user stats
      const realPlayers: BattlePlayer[] = await Promise.all(
        battleRoomData.participants.map(async (participant: any) => {
          const userStats = await SupabaseService.getUserStats(participant.user_id);
          
          return {
            id: participant.id,
            user_id: participant.user_id,
            full_name: participant.profiles?.full_name || 'Player',
            score: participant.current_score || 0,
            current_question: 0,
            is_ready: false, // Will be updated by real-time subscriptions
            is_host: participant.user_id === battleRoomData.room.host_id,
            status: 'waiting' as const,
            level: userStats?.current_level || 1,
            streak_days: userStats?.streak_days || 0,
          };
        })
      );
      
      if (!isMounted.current) return;
      setRoom(realRoom);
      setPlayers(realPlayers);
      setIsHost(realRoom.host_id === user.id);
      setRoomCode(roomId?.toString().slice(-6).toUpperCase() || 'ABC123');

      // Subscribe to real-time updates
      const subscription = SupabaseService.subscribeToBattleRoom(roomId as string, (payload) => {
        console.log('🔄 Battle room update:', payload);
        // Handle real-time updates here
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('Error loading battle room:', error);
      if (!isMounted.current) return;
      Alert.alert('Error', 'Failed to load battle room. Please try again.');
      router.back();
    } finally {
      if (!isMounted.current) return;
      setIsLoading(false);
    }
  };

  const handleReady = () => {
    setPlayers(prev => prev.map(player => 
      player.user_id === currentUser.id 
        ? { ...player, is_ready: !player.is_ready, status: player.is_ready ? 'waiting' : 'ready' }
        : player
    ));
    
    // Ready animation
    readyPulse.value = withSequence(
      withTiming(1.3, { duration: 200 }),
      withTiming(1, { duration: 200 })
    );
  };

  const handleStartBattle = () => {
    const allReady = players.every(p => p.is_ready);
    
    if (!allReady) {
      Alert.alert('Not Ready', 'All players must be ready before starting the battle!');
      return;
    }

    if (players.length < 2) {
      Alert.alert('Need More Players', 'At least 2 players are required for a battle!');
      return;
    }

    // Start countdown
    setCountdown(3);
    
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          // Navigate to live quiz
          router.push({
            pathname: '/battle/live-quiz',
            params: { 
              roomId: room.id,
              topic: room.topic,
              subject: room.subject,
            },
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleShareRoom = async () => {
    const shareText = `🔥 Join my Quiz Battle! 🔥

Room: ${room.name}
Topic: ${room.topic} (${room.subject})
Code: ${roomCode}

Challenge me in India's #1 AI learning platform!

Download MindGains AI: https://mindgains.ai
#MindGainsAI #QuizBattle #CompetitiveExams`;

    try {
      await Share.share({
        message: shareText,
        title: 'Quiz Battle Invitation',
      });
    } catch (error) {
      console.error('Error sharing room:', error);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ translateY: interpolate(fadeIn.value, [0, 1], [30, 0]) }],
  }));

  const playersAnimatedStyle = useAnimatedStyle(() => ({
    opacity: playersOpacity.value,
    transform: [{ translateY: interpolate(playersOpacity.value, [0, 1], [20, 0]) }],
  }));

  const countdownAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countdownScale.value }],
  }));

  const readyAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: readyPulse.value }],
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
          <Text style={styles.loadingText}>Entering battle room...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (!room) {
    return (
      <LinearGradient
        colors={[
          theme.colors.background.primary,
          theme.colors.background.secondary,
        ]}
        style={styles.container}
      >
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Battle room not found</Text>
          <GradientButton
            title="Back to Battle Arena"
            onPress={() => router.back()}
            size="medium"
          />
        </View>
      </LinearGradient>
    );
  }

  const currentPlayer = players.find(p => p.user_id === currentUser.id);
  const allReady = players.every(p => p.is_ready);

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
      
      {/* Countdown Overlay */}
      {countdown > 0 && (
        <View style={styles.countdownOverlay}>
          <LinearGradient
            colors={[
              'rgba(0, 0, 0, 0.8)',
              'rgba(0, 0, 0, 0.9)',
            ]}
            style={styles.countdownBackground}
          >
            <Animated.View style={[styles.countdownContainer, countdownAnimatedStyle]}>
              <Text style={styles.countdownText}>{countdown}</Text>
              <Text style={styles.countdownLabel}>Battle starts in...</Text>
            </Animated.View>
          </LinearGradient>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[theme.colors.background.card, theme.colors.background.secondary]}
            style={styles.backButtonGradient}
          >
            <FontAwesome5 name="chevron-left" size={20} color={theme.colors.text.primary} />
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.roomTitle}>{room.name}</Text>
          <Text style={styles.roomSubtitle}>
            {room.topic} • {room.subject}
          </Text>
        </View>
        
        <TouchableOpacity style={styles.shareButton} onPress={handleShareRoom}>
          <LinearGradient
            colors={[theme.colors.accent.green, theme.colors.accent.cyan]}
            style={styles.shareButtonGradient}
          >
            <FontAwesome5 name="share-alt" size={16} color={theme.colors.text.primary} solid />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Room Info */}
      <Animated.View style={[styles.roomInfoSection, animatedStyle]}>
        <LinearGradient
          colors={[
            theme.colors.background.card,
            theme.colors.background.secondary,
          ]}
          style={styles.roomInfoCard}
        >
          <View style={styles.roomInfoHeader}>
            <View style={styles.roomCodeContainer}>
              <FontAwesome5 name="key" size={16} color={theme.colors.accent.yellow} solid />
              <Text style={styles.roomCodeLabel}>Room Code:</Text>
              <Text style={styles.roomCodeText}>{roomCode}</Text>
            </View>
            
            <View style={styles.playersCount}>
              <FontAwesome5 name="users" size={16} color={theme.colors.accent.blue} solid />
              <Text style={styles.playersCountText}>
                {players.length}/{room.max_players}
              </Text>
            </View>
          </View>
          
          <View style={styles.battleMeta}>
            <View style={styles.battleMetaItem}>
              <FontAwesome5 name="question-circle" size={14} color={theme.colors.accent.green} />
              <Text style={styles.battleMetaText}>10 Questions</Text>
            </View>
            <View style={styles.battleMetaItem}>
              <FontAwesome5 name="clock" size={14} color={theme.colors.accent.purple} />
              <Text style={styles.battleMetaText}>30s per question</Text>
            </View>
            <View style={styles.battleMetaItem}>
              <FontAwesome5 name="trophy" size={14} color={theme.colors.accent.gold} />
              <Text style={styles.battleMetaText}>Winner takes all!</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Players List */}
      <Animated.View style={[styles.playersSection, playersAnimatedStyle]}>
        <Text style={styles.playersTitle}>
          <FontAwesome5 name="sword" size={18} color={theme.colors.accent.pink} solid />
          {' '}Battle Warriors
        </Text>
        
        <View style={styles.playersList}>
          {players.map((player, index) => (
            <BattlePlayerCard
              key={player.id}
              player={player}
              index={index}
              isCurrentUser={player.user_id === currentUser?.id}
            />
          ))}
          
          {/* Empty slots */}
          {[...Array(room.max_players - players.length)].map((_, index) => (
            <EmptyPlayerSlot key={`empty_${index}`} index={players.length + index} />
          ))}
        </View>
      </Animated.View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {!currentPlayer?.is_ready ? (
          <Animated.View style={readyAnimatedStyle}>
            <GradientButton
              title="Ready for Battle!"
              onPress={handleReady}
              size="large"
              fullWidth
              icon={<FontAwesome5 name="check-circle" size={20} color={theme.colors.text.primary} solid />}
              colors={[theme.colors.accent.green, theme.colors.accent.cyan]}
              style={[styles.readyButton, battleGlowAnimatedStyle]}
            />
          </Animated.View>
        ) : (
          <View style={styles.readyStatus}>
            <LinearGradient
              colors={[theme.colors.accent.green + '30', theme.colors.accent.green + '20']}
              style={styles.readyStatusGradient}
            >
              <FontAwesome5 name="check-circle" size={24} color={theme.colors.accent.green} solid />
              <Text style={styles.readyStatusText}>You're Ready!</Text>
            </LinearGradient>
          </View>
        )}

        {isHost && allReady && players.length >= 2 && (
          <GradientButton
            title="Start Battle!"
            onPress={handleStartBattle}
            size="large"
            fullWidth
            icon={<FontAwesome5 name="rocket" size={20} color={theme.colors.text.primary} solid />}
            colors={[theme.colors.accent.pink, theme.colors.accent.purple]}
            style={styles.startButton}
          />
        )}

        {!allReady && (
          <View style={styles.waitingStatus}>
            <Text style={styles.waitingText}>
              Waiting for all players to be ready...
            </Text>
            <View style={styles.readyIndicators}>
              {players.map((player) => (
                <View
                  key={player.id}
                  style={[
                    styles.readyIndicator,
                    player.is_ready && styles.readyIndicatorActive,
                  ]}
                >
                  <FontAwesome5 
                    name={player.is_ready ? "check" : "clock"} 
                    size={12} 
                    color={player.is_ready ? theme.colors.accent.green : theme.colors.text.tertiary} 
                    solid 
                  />
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

function BattlePlayerCard({ player, index, isCurrentUser }: {
  player: BattlePlayer;
  index: number;
  isCurrentUser: boolean;
}) {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    setTimeout(() => {
      opacity.value = withTiming(1, { duration: 400 });
      scale.value = withSpring(1, { damping: 15, stiffness: 100 });
    }, index * 200);
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const getPlayerColor = () => {
    if (isCurrentUser) return theme.colors.accent.purple;
    if (player.is_host) return theme.colors.accent.gold;
    return theme.colors.accent.blue;
  };

  const getStatusIcon = () => {
    if (player.is_ready) return 'check-circle';
    return 'clock';
  };

  const getStatusColor = () => {
    if (player.is_ready) return theme.colors.accent.green;
    return theme.colors.accent.yellow;
  };

  return (
    <Animated.View style={[styles.playerCard, animatedStyle]}>
      <LinearGradient
        colors={
          isCurrentUser
            ? [theme.colors.accent.purple + '30', theme.colors.accent.purple + '20']
            : [theme.colors.background.card, theme.colors.background.secondary]
        }
        style={[
          styles.playerCardGradient,
          isCurrentUser && styles.currentPlayerCard,
        ]}
      >
        {/* Player Avatar */}
        <View style={styles.playerAvatarContainer}>
          <LinearGradient
            colors={[getPlayerColor(), getPlayerColor() + '80']}
            style={styles.playerAvatar}
          >
            <Text style={styles.playerAvatarText}>
              {player.full_name.charAt(0)}
            </Text>
            
            {/* Host crown */}
            {player.is_host && (
              <View style={styles.hostCrown}>
                <FontAwesome5 name="crown" size={12} color={theme.colors.accent.gold} solid />
              </View>
            )}
            
            {/* Ready status */}
            <View style={[styles.playerStatus, { backgroundColor: getStatusColor() }]}>
              <FontAwesome5 name={getStatusIcon()} size={8} color={theme.colors.text.primary} solid />
            </View>
          </LinearGradient>
        </View>

        {/* Player Info */}
        <View style={styles.playerInfo}>
          <Text style={[
            styles.playerName,
            isCurrentUser && { color: theme.colors.accent.purple }
          ]}>
            {player.full_name} {isCurrentUser && '(You)'}
          </Text>
          
          <View style={styles.playerStats}>
            <View style={styles.playerStat}>
              <FontAwesome5 name="layer-group" size={10} color={theme.colors.accent.blue} />
              <Text style={styles.playerStatText}>L{player.level}</Text>
            </View>
            
            <View style={styles.playerStat}>
              <FontAwesome5 name="fire" size={10} color={theme.colors.accent.yellow} solid />
              <Text style={styles.playerStatText}>{player.streak_days}</Text>
            </View>
            
            {player.is_host && (
              <View style={styles.hostBadge}>
                <FontAwesome5 name="crown" size={10} color={theme.colors.accent.gold} solid />
                <Text style={styles.hostBadgeText}>HOST</Text>
              </View>
            )}
          </View>
        </View>

        {/* Ready Indicator */}
        <View style={styles.readyIndicatorContainer}>
          {player.is_ready ? (
            <LinearGradient
              colors={[theme.colors.accent.green, theme.colors.accent.green + '80']}
              style={styles.readyBadge}
            >
              <FontAwesome5 name="check" size={14} color={theme.colors.text.primary} solid />
            </LinearGradient>
          ) : (
            <View style={styles.notReadyBadge}>
              <FontAwesome5 name="clock" size={14} color={theme.colors.accent.yellow} solid />
            </View>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function EmptyPlayerSlot({ index }: { index: number }) {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    setTimeout(() => {
      opacity.value = withTiming(0.6, { duration: 400 });
      scale.value = withSpring(1, { damping: 15, stiffness: 100 });
    }, index * 200);
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.emptySlot, animatedStyle]}>
      <LinearGradient
        colors={[theme.colors.background.tertiary, theme.colors.background.secondary]}
        style={styles.emptySlotGradient}
      >
        <FontAwesome5 name="user-plus" size={24} color={theme.colors.text.tertiary} />
        <Text style={styles.emptySlotText}>Waiting for player...</Text>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  errorText: {
    fontSize: 18,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  countdownBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownContainer: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  countdownText: {
    fontSize: 120,
    fontFamily: theme.fonts.heading,
    color: theme.colors.accent.yellow,
    textShadowColor: theme.colors.accent.yellow + '50',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  countdownLabel: {
    fontSize: 20,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  backButton: {
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  backButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.tertiary,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  roomTitle: {
    fontSize: 20,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  roomSubtitle: {
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  shareButton: {
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  shareButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.tertiary,
  },
  roomInfoSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  roomInfoCard: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    ...theme.shadows.card,
  },
  roomInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  roomCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  roomCodeLabel: {
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
  },
  roomCodeText: {
    fontSize: 16,
    fontFamily: theme.fonts.heading,
    color: theme.colors.accent.yellow,
    backgroundColor: theme.colors.accent.yellow + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  playersCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  playersCountText: {
    fontSize: 16,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.accent.blue,
  },
  battleMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  battleMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  battleMetaText: {
    fontSize: 12,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
  },
  playersSection: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  playersTitle: {
    fontSize: 20,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  playersList: {
    gap: theme.spacing.md,
  },
  playerCard: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  playerCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border.tertiary,
    borderRadius: theme.borderRadius.lg,
  },
  currentPlayerCard: {
    borderColor: theme.colors.accent.purple,
    ...theme.shadows.glow,
  },
  playerAvatarContainer: {
    position: 'relative',
    marginRight: theme.spacing.md,
  },
  playerAvatar: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  playerAvatarText: {
    color: theme.colors.text.primary,
    fontSize: 20,
    fontFamily: theme.fonts.heading,
  },
  hostCrown: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.accent.gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background.card,
  },
  playerStatus: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background.card,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  playerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  playerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playerStatText: {
    fontSize: 12,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
  },
  hostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent.gold + '20',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
  },
  hostBadgeText: {
    fontSize: 10,
    fontFamily: theme.fonts.caption,
    color: theme.colors.accent.gold,
    fontWeight: 'bold',
  },
  readyIndicatorContainer: {
    marginLeft: theme.spacing.sm,
  },
  readyBadge: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notReadyBadge: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySlot: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  emptySlotGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.border.tertiary,
    borderStyle: 'dashed',
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm,
  },
  emptySlotText: {
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.tertiary,
  },
  actionsContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  readyButton: {
    shadowColor: theme.colors.accent.green,
  },
  readyStatus: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  readyStatusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.accent.green + '40',
  },
  readyStatusText: {
    fontSize: 18,
    fontFamily: theme.fonts.heading,
    color: theme.colors.accent.green,
  },
  startButton: {
    ...theme.shadows.glow,
  },
  waitingStatus: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  waitingText: {
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  readyIndicators: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  readyIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readyIndicatorActive: {
    backgroundColor: theme.colors.accent.green,
  },
});