import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  StatusBar,
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
  interpolate,
  Easing,
} from 'react-native-reanimated';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { theme } from '@/constants/theme';
import MascotAvatar from '@/components/ui/MascotAvatar';
import GradientButton from '@/components/ui/GradientButton';
import { SupabaseService } from '@/utils/supabaseService';
import { demoUserStats } from '@/utils/demoData';

const { width = 375 } = Dimensions.get('window') || {};

interface UserStats {
  currentLevel: number;
  totalXP: number;
  streakDays: number;
  totalQuizzes: number;
  accuracy: number;
  rank: number;
}

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  gradient: string[];
  onPress: () => void;
  badge?: string;
  isHighlighted?: boolean;
}

export default function Home() {
  const isMounted = useRef(true);
  const [userStats, setUserStats] = useState<UserStats>({
    currentLevel: 12,
    totalXP: 8450,
    streakDays: 15,
    totalQuizzes: 87,
    accuracy: 85,
    rank: 234,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('');

  // Animation values
  const fadeIn = useSharedValue(0);
  const headerScale = useSharedValue(0.9);
  const progressScale = useSharedValue(0.8);
  const actionsOpacity = useSharedValue(0);
  const mascotScale = useSharedValue(1);
  const shimmerPosition = useSharedValue(-1);
  const streakPulse = useSharedValue(1);

  useEffect(() => {
    isMounted.current = true;
    loadUserData();
    setGreeting(getTimeBasedGreeting());
    startAnimations();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const startAnimations = () => {
    fadeIn.value = withTiming(1, { duration: 800 });
    headerScale.value = withSpring(1, { damping: 15, stiffness: 100 });
    progressScale.value = withSpring(1, { damping: 12, stiffness: 120 });
    actionsOpacity.value = withTiming(1, { duration: 600, delay: 400 });
    
    // Continuous animations
    mascotScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    
    streakPulse.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
    
    shimmerPosition.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );
  };

  const loadUserData = async () => {
    try {
      if (!isMounted.current) return;
      
      const user = await SupabaseService.getCurrentUser();
      if (!user) {
        router.replace('/auth');
        return;
      }

      const [stats] = await Promise.allSettled([
        SupabaseService.getUserStats(user.id),
      ]);
      
      if (stats.status === 'fulfilled' && stats.value) {
        setUserStats({
          currentLevel: stats.value.current_level,
          totalXP: stats.value.total_xp,
          streakDays: stats.value.streak_days,
          totalQuizzes: 0, // Will be calculated from real data
          accuracy: 0, // Will be calculated from real data
          rank: 0, // Will be calculated from real data
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      if (!isMounted.current) return;
      router.replace('/auth');
    } finally {
      if (!isMounted.current) return;
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUserData().finally(() => setRefreshing(false));
  };

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const quickActions: QuickAction[] = [
    {
      id: 'daily',
      title: 'Daily Quiz',
      subtitle: 'Fresh questions every day',
      icon: 'calendar-day',
      gradient: [theme.colors.accent.purple, theme.colors.accent.blue],
      onPress: () => router.push('/quiz/daily'),
      badge: 'NEW',
      isHighlighted: true,
    },
    {
      id: 'topic',
      title: 'Topic Quiz',
      subtitle: 'Focus on specific subjects',
      icon: 'bullseye',
      gradient: [theme.colors.accent.green, theme.colors.accent.cyan],
      onPress: () => router.push('/quiz/topic'),
    },
    {
      id: 'create',
      title: 'Create Mission',
      subtitle: 'Transform content to learning',
      icon: 'magic',
      gradient: [theme.colors.accent.yellow, theme.colors.accent.green],
      onPress: () => router.push('/mission/create'),
    },
    {
      id: 'leaderboard',
      title: 'Leaderboard',
      subtitle: 'Compete with friends',
      icon: 'trophy',
      gradient: [theme.colors.accent.pink, theme.colors.accent.purple],
      onPress: () => router.push('/(tabs)/leaderboard'),
    },
  ];

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ translateY: interpolate(fadeIn.value, [0, 1], [30, 0]) }],
  }));

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: headerScale.value }],
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: progressScale.value }],
  }));

  const actionsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: actionsOpacity.value,
    transform: [{ translateY: interpolate(actionsOpacity.value, [0, 1], [20, 0]) }],
  }));

  const mascotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: mascotScale.value }],
  }));

  const streakAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: streakPulse.value }],
  }));

  const shimmerAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerPosition.value,
      [-1, 1],
      [-width * 1.5, width * 1.5]
    );
    
    return {
      transform: [{ translateX }],
    };
  });

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
      
      <View style={styles.safeArea}>
        {/* Enhanced Content */}
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
            {/* Enhanced Header */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <View style={styles.greetingSection}>
                  <Text style={styles.greeting}>{greeting}!</Text>
                  <Text style={styles.subtitle}>Ready to gain some mind power?</Text>
                </View>
                
                <View style={styles.headerRight}>
                  <Animated.View style={mascotAnimatedStyle}>
                    <MascotAvatar
                      size={60}
                      animated={true}
                      glowing={true}
                      mood="happy"
                    />
                  </Animated.View>
                  
                  <LinearGradient
                    colors={[theme.colors.accent.purple, theme.colors.accent.blue]}
                    style={styles.brainContainer}
                  >
                    <FontAwesome5 name="brain" size={24} color={theme.colors.text.primary} solid />
                  </LinearGradient>
                </View>
              </View>
              
            </View>

            {/* Enhanced Progress Card */}
            <Animated.View style={[styles.progressSection, progressAnimatedStyle]}>
              <LinearGradient
                colors={[theme.colors.accent.purple, theme.colors.accent.blue, theme.colors.accent.cyan]}
                style={styles.progressCard}
              >
                {/* Shimmer effect */}
                <View style={styles.shimmerContainer}>
                  <Animated.View style={[styles.shimmerOverlay, shimmerAnimatedStyle]}>
                    <LinearGradient
                      colors={['transparent', 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0.2)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.shimmerGradient}
                    />
                  </Animated.View>
                </View>
                
                <View style={styles.progressContent}>
                  <View style={styles.levelRow}>
                    <View style={styles.levelBadge}>
                      <FontAwesome5 name="crown" size={16} color={theme.colors.text.primary} solid />
                      <Text style={styles.levelText}>Level {userStats.currentLevel}</Text>
                    </View>
                    
                    <Animated.View style={[styles.streakBadge, streakAnimatedStyle]}>
                      <FontAwesome5 name="fire" size={14} color={theme.colors.text.primary} solid />
                      <Text style={styles.streakText}>{userStats.streakDays}</Text>
                    </Animated.View>
                  </View>
                  
                  <View style={styles.xpSection}>
                    <Text style={styles.xpText}>
                      {userStats.totalXP.toLocaleString()} XP
                    </Text>
                    <Text style={styles.rankText}>
                      <FontAwesome5 name="chart-line" size={12} color={theme.colors.text.primary} solid />
                      {' '}Rank #{userStats.rank}
                    </Text>
                  </View>
                  
                  <View style={styles.progressBarSection}>
                    <View style={styles.progressBar}>
                      <LinearGradient
                        colors={[theme.colors.accent.yellow, theme.colors.accent.green]}
                        style={[styles.progressFill, { width: '65%' }]}
                      />
                    </View>
                    <Text style={styles.progressLabel}>
                      <FontAwesome5 name="arrow-up" size={10} color={theme.colors.text.primary} solid />
                      {' '}450 XP to Level {userStats.currentLevel + 1}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </LinearGradient>
            </Animated.View>

            {/* Enhanced Stats Grid */}
            <View style={styles.statsSection}>
              <Text style={styles.sectionTitle}>
                <FontAwesome5 name="chart-pie" size={18} color={theme.colors.accent.blue} solid />
                {' '}Your Progress
              </Text>
              
              <View style={styles.statsGrid}>
                <EnhancedStatCard 
                  icon="bullseye" 
                  label="Accuracy" 
                  value={`${userStats.accuracy}%`} 
                  color={theme.colors.accent.green}
                  trend="+5%"
                />
                <EnhancedStatCard 
                  icon="trophy" 
                  label="Rank" 
                  value={`#${userStats.rank}`} 
                  color={theme.colors.accent.gold}
                  trend="↑12"
                />
                <EnhancedStatCard 
                  icon="book-open" 
                  label="Quizzes" 
                  value={userStats.totalQuizzes.toString()} 
                  color={theme.colors.accent.purple}
                  trend="+3"
                />
                <EnhancedStatCard 
                  icon="fire" 
                  label="Streak" 
                  value={`${userStats.streakDays}d`} 
                  color={theme.colors.accent.yellow}
                  trend="🔥"
                />
              </View>
            </View>

            {/* Enhanced Quick Actions */}
            <Animated.View style={[styles.actionsSection, actionsAnimatedStyle]}>
              <Text style={styles.sectionTitle}>
                <FontAwesome5 name="rocket" size={18} color={theme.colors.accent.purple} solid />
                {' '}Start Learning
              </Text>
              
              <View style={styles.actionsContainer}>
                {quickActions.map((action, index) => (
                  <EnhancedActionCard
                    key={action.id}
                    action={action}
                    index={index}
                  />
                ))}
              </View>
            </Animated.View>

            {/* Enhanced Activity Feed */}
            <View style={styles.activitySection}>
              <Text style={styles.sectionTitle}>
                <FontAwesome5 name="history" size={18} color={theme.colors.accent.cyan} solid />
                {' '}Recent Activity
              </Text>
              
              <View style={styles.activityCard}>
                <ActivityItem
                  icon="trophy"
                  title="Perfect Score!"
                  subtitle="Daily Quiz • 2 hours ago"
                  points="+50 XP"
                  color={theme.colors.accent.green}
                />
                
                <ActivityItem
                  icon="crown"
                  title="Level Up!"
                  subtitle="Reached Level 12 • Yesterday"
                  points="+100 XP"
                  color={theme.colors.accent.gold}
                />
                
                <ActivityItem
                  icon="fire"
                  title="Streak Master"
                  subtitle="15 day streak • 2 days ago"
                  points="+75 XP"
                  color={theme.colors.accent.yellow}
                />
                
                <ActivityItem
                  icon="users"
                  title="Friend Challenge Victory"
                  subtitle="Beat Priya in History • 3 days ago"
                  points="+60 XP"
                  color={theme.colors.accent.purple}
                />
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

function EnhancedStatCard({ icon, label, value, color, trend }: {
  icon: string;
  label: string;
  value: string;
  color: string;
  trend?: string;
}) {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 600 });
    scale.value = withSpring(1, { damping: 15, stiffness: 100 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.statCard, animatedStyle]}>
      <LinearGradient
        colors={[color + '20', color + '10']}
        style={styles.statCardGradient}
      >
        <View style={[styles.statIcon, { backgroundColor: color + '30' }]}>
          <FontAwesome5 name={icon} size={20} color={color} solid />
        </View>
        
        <View style={styles.statContent}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statLabel}>{label}</Text>
          
          {trend && (
            <View style={styles.trendContainer}>
              <Text style={[styles.trendText, { color }]}>{trend}</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function EnhancedActionCard({ action, index }: {
  action: QuickAction;
  index: number;
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
    action.onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.actionCard, animatedStyle]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <LinearGradient
          colors={action.gradient}
          style={[styles.actionGradient, action.isHighlighted && styles.highlightedAction]}
        >
          {action.badge && (
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>{action.badge}</Text>
            </View>
          )}
          
          <View style={styles.actionContent}>
            <View style={styles.actionIcon}>
              <FontAwesome5 name={action.icon} size={24} color={theme.colors.text.primary} solid />
            </View>
            
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
            </View>
            
            <View style={styles.actionArrow}>
              <FontAwesome5 name="chevron-right" size={16} color={theme.colors.text.primary} />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ActivityItem({ icon, title, subtitle, points, color }: {
  icon: string;
  title: string;
  subtitle: string;
  points: string;
  color: string;
}) {
  return (
    <View style={styles.activityItem}>
      <View style={[styles.activityIcon, { backgroundColor: color }]}>
        <FontAwesome5 name={icon} size={16} color={theme.colors.text.primary} solid />
      </View>
      
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activityTime}>{subtitle}</Text>
      </View>
      
      <View style={styles.activityPoints}>
        <FontAwesome5 name="coins" size={12} color={theme.colors.accent.yellow} solid />
        <Text style={styles.activityPointsText}>{points}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  greetingSection: {
    flex: 1,
  },
  greeting: {
    fontSize: 28,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  brainContainer: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.glow,
  },
  recommendationBubble: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  recommendationGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.tertiary,
  },
  recommendationText: {
    fontSize: 14,
    fontFamily: theme.fonts.body,
    color: theme.colors.text.primary,
    flex: 1,
  },
  progressSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  progressCard: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.card,
    position: 'relative',
    overflow: 'hidden',
  },
  shimmerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: width * 2,
    height: 200,
    opacity: 0.3,
  },
  shimmerGradient: {
    flex: 1,
  },
  progressContent: {
    gap: theme.spacing.lg,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.xs,
  },
  levelText: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontFamily: theme.fonts.subheading,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.xs,
  },
  streakText: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontFamily: theme.fonts.subheading,
  },
  xpSection: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  xpText: {
    fontSize: 36,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
  },
  rankText: {
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.primary,
    opacity: 0.9,
  },
  progressBarSection: {
    gap: theme.spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.sm,
  },
  progressLabel: {
    color: theme.colors.text.primary,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    opacity: 0.9,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  statsSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  statCard: {
    width: '47%',
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  statCardGradient: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.tertiary,
    borderRadius: theme.borderRadius.lg,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  statContent: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statValue: {
    fontSize: 20,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  trendContainer: {
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  trendText: {
    fontSize: 10,
    fontFamily: theme.fonts.caption,
    fontWeight: 'bold',
  },
  actionsSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  actionsContainer: {
    gap: theme.spacing.md,
  },
  actionCard: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  actionGradient: {
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.card,
    position: 'relative',
  },
  highlightedAction: {
    ...theme.shadows.glow,
  },
  actionBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: theme.colors.accent.yellow,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    zIndex: 1,
  },
  actionBadgeText: {
    fontSize: 10,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.inverse,
    fontWeight: 'bold',
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  actionSubtitle: {
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  actionArrow: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activitySection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  activityCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    ...theme.shadows.card,
    gap: theme.spacing.md,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  activityTime: {
    fontSize: 12,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
  },
  activityPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityPointsText: {
    fontSize: 14,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.accent.yellow,
  },
});