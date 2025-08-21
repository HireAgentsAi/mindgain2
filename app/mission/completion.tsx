import React, { useEffect } from 'react';
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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
  withDelay,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { Trophy, Star, Clock, Target, Brain, Zap, Chrome as Home, Share2 } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import MascotAvatar from '@/components/ui/MascotAvatar';
import GradientButton from '@/components/ui/GradientButton';
import { SupabaseService } from '@/utils/supabaseService';

export default function MissionCompletionScreen() {
  const params = useLocalSearchParams();
  const { missionId, finalScore, timeSpent } = params;
  
  const mascotScale = useSharedValue(0.8);
  const badgeScale = useSharedValue(0);
  const statsOpacity = useSharedValue(0);
  const confettiOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    // Celebration animation sequence
    const startCelebration = () => {
      // Mascot entrance
      mascotScale.value = withSpring(1.2, { damping: 10, stiffness: 100 });
      
      // Badge animation
      setTimeout(() => {
        badgeScale.value = withSpring(1, { damping: 12, stiffness: 150 });
      }, 300);
      
      // Stats fade in
      setTimeout(() => {
        statsOpacity.value = withTiming(1, { duration: 600 });
      }, 600);
      
      // Confetti
      setTimeout(() => {
        confettiOpacity.value = withTiming(1, { duration: 400 });
      }, 800);
      
      // Buttons
      setTimeout(() => {
        buttonOpacity.value = withTiming(1, { duration: 600 });
      }, 1000);
      
      // Continuous mascot celebration
      setTimeout(() => {
        mascotScale.value = withRepeat(
          withSequence(
            withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
            withTiming(1.2, { duration: 1000, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        );
      }, 1200);
    };

    startCelebration();
  }, []);

  const mascotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: mascotScale.value }],
  }));

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
    opacity: badgeScale.value,
  }));

  const statsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: statsOpacity.value,
    transform: [{ translateY: (1 - statsOpacity.value) * 20 }],
  }));

  const confettiAnimatedStyle = useAnimatedStyle(() => ({
    opacity: confettiOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: (1 - buttonOpacity.value) * 30 }],
  }));

  const handleGoHome = () => {
    router.replace('/(tabs)');
  };

  const handleShareResults = () => {
    handleShare();
  };

  const handleShare = async () => {
    const shareText = `🏆 Mission Complete: ${score}% Score!

⏱️ Completed in ${timeInMinutes} minutes
🎯 All 4 learning rooms mastered
🧠 Knowledge gained with MindGains AI

Join India's #1 AI learning platform:
📱 Download: https://mindgains.ai

#MindGainsAI #MissionComplete #AILearning`;

    try {
      await Share.share({
        message: shareText,
        title: 'Mission Complete',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const score = parseInt(finalScore as string) || 0;
  const timeInMinutes = Math.round((parseInt(timeSpent as string) || 0) / 60);
  
  const getPerformanceMessage = (score: number) => {
    if (score >= 90) return "Outstanding! You're a true scholar! 🌟";
    if (score >= 80) return "Excellent work! You've mastered this topic! 🎯";
    if (score >= 70) return "Great job! You're making solid progress! 💪";
    if (score >= 60) return "Good effort! Keep practicing to improve! 📚";
    return "Nice try! Review the material and try again! 🔄";
  };

  const getGradeColor = (score: number) => {
    if (score >= 90) return theme.colors.accent.green;
    if (score >= 80) return theme.colors.accent.cyan;
    if (score >= 70) return theme.colors.accent.blue;
    if (score >= 60) return theme.colors.accent.yellow;
    return theme.colors.accent.pink;
  };

  return (
    <LinearGradient
      colors={[
        theme.colors.background.primary,
        theme.colors.background.secondary,
        theme.colors.background.tertiary,
      ]}
      style={styles.container}
    >
      {/* Floating Confetti */}
      <Animated.View style={[styles.confettiContainer, confettiAnimatedStyle]}>
        {[...Array(20)].map((_, index) => (
          <ConfettiPiece key={index} index={index} />
        ))}
      </Animated.View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Animated.View style={mascotAnimatedStyle}>
            <MascotAvatar
              size={120}
              animated={true}
              glowing={true}
              mood="celebrating"
            />
          </Animated.View>
          
          <Animated.View style={[styles.completionBadge, badgeAnimatedStyle]}>
            <LinearGradient
              colors={[theme.colors.accent.yellow, theme.colors.accent.green]}
              style={styles.badgeGradient}
            >
              <Trophy size={40} color={theme.colors.text.primary} />
              <Text style={styles.badgeTitle}>Mission Complete!</Text>
            </LinearGradient>
          </Animated.View>
          
          <Text style={styles.congratsText}>
            🎉 Congratulations! 🎉
          </Text>
          <Text style={styles.messageText}>
            {getPerformanceMessage(score)}
          </Text>
        </View>

        {/* Score Display */}
        <Animated.View style={[styles.scoreContainer, statsAnimatedStyle]}>
          <LinearGradient
            colors={[
              theme.colors.background.card,
              theme.colors.background.secondary,
            ]}
            style={styles.scoreCard}
          >
            <View style={styles.scoreHeader}>
              <Text style={styles.scoreLabel}>Final Score</Text>
              <Star size={24} color={theme.colors.accent.yellow} />
            </View>
            
            <Text style={[styles.scoreValue, { color: getGradeColor(score) }]}>
              {score}%
            </Text>
            
            <View style={styles.scoreBar}>
              <View style={styles.scoreBarBg}>
                <LinearGradient
                  colors={[getGradeColor(score), getGradeColor(score) + '80']}
                  style={[styles.scoreBarFill, { width: `${score}%` }]}
                />
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Stats Grid */}
        <Animated.View style={[styles.statsContainer, statsAnimatedStyle]}>
          <Text style={styles.statsTitle}>Mission Summary</Text>
          
          <View style={styles.statsGrid}>
            <StatCard
              icon={<Target size={24} color={theme.colors.text.primary} />}
              title="Rooms Completed"
              value="4/4"
              color={theme.colors.accent.purple}
            />
            
            <StatCard
              icon={<Clock size={24} color={theme.colors.text.primary} />}
              title="Time Spent"
              value={`${timeInMinutes}m`}
              color={theme.colors.accent.blue}
            />
            
            <StatCard
              icon={<Brain size={24} color={theme.colors.text.primary} />}
              title="Knowledge Gained"
              value="100%"
              color={theme.colors.accent.cyan}
            />
            
            <StatCard
              icon={<Zap size={24} color={theme.colors.text.primary} />}
              title="XP Earned"
              value={`${Math.round(score * 2)}XP`}
              color={theme.colors.accent.yellow}
            />
          </View>
        </Animated.View>

        {/* Learning Journey */}
        <Animated.View style={[styles.journeyContainer, statsAnimatedStyle]}>
          <Text style={styles.journeyTitle}>Your Learning Journey</Text>
          
          <View style={styles.journeySteps}>
            <JourneyStep
              number={1}
              title="Room of Clarity"
              description="Understood the fundamentals"
              completed={true}
              color={theme.colors.accent.yellow}
            />
            
            <JourneyStep
              number={2}
              title="Quiz Arena"
              description="Tested your knowledge"
              completed={true}
              color={theme.colors.accent.blue}
            />
            
            <JourneyStep
              number={3}
              title="Memory Forge"
              description="Strengthened recall"
              completed={true}
              color={theme.colors.accent.purple}
            />
            
            <JourneyStep
              number={4}
              title="Test Tower"
              description="Proved your mastery"
              completed={true}
              color={theme.colors.accent.green}
            />
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View style={[styles.actionsContainer, buttonAnimatedStyle]}>
          <GradientButton
            title="Back to Home"
            onPress={handleGoHome}
            size="large"
            fullWidth
            icon={<Home size={20} color={theme.colors.text.primary} />}
            colors={[theme.colors.accent.purple, theme.colors.accent.blue]}
            style={styles.actionButton}
          />
          
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareResults}
          >
            <LinearGradient
              colors={[theme.colors.background.card, theme.colors.background.secondary]}
              style={styles.shareButtonGradient}
            >
              <Share2 size={20} color={theme.colors.accent.cyan} />
              <Text style={styles.shareButtonText}>Share Results</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </LinearGradient>
  );
}

function ConfettiPiece({ index }: { index: number }) {
  const translateY = useSharedValue(-100);
  const translateX = useSharedValue(Math.random() * 400 - 200);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const delay = Math.random() * 2000;
    const duration = 3000 + Math.random() * 2000;
    
    setTimeout(() => {
      translateY.value = withTiming(800, { duration });
      rotation.value = withTiming(360 * 3, { duration });
      opacity.value = withTiming(0, { duration: duration * 0.8 });
    }, delay);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const colors = [
    theme.colors.accent.purple,
    theme.colors.accent.blue,
    theme.colors.accent.cyan,
    theme.colors.accent.yellow,
    theme.colors.accent.green,
    theme.colors.accent.pink,
  ];

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        {
          backgroundColor: colors[index % colors.length],
          left: Math.random() * 400,
        },
        animatedStyle,
      ]}
    />
  );
}

function StatCard({ icon, title, value, color }: {
  icon: React.ReactNode;
  title: string;
  value: string;
  color: string;
}) {
  return (
    <LinearGradient
      colors={[color + '20', color + '10']}
      style={styles.statCard}
    >
      <View style={[styles.statIcon, { backgroundColor: color + '30' }]}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </LinearGradient>
  );
}

function JourneyStep({ number, title, description, completed, color }: {
  number: number;
  title: string;
  description: string;
  completed: boolean;
  color: string;
}) {
  return (
    <View style={styles.journeyStep}>
      <View style={[styles.stepNumber, { backgroundColor: color }]}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDescription}>{description}</Text>
      </View>
      {completed && (
        <View style={styles.stepCheck}>
          <Trophy size={16} color={theme.colors.accent.green} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    pointerEvents: 'none',
  },
  confettiPiece: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scrollView: {
    flex: 1,
    zIndex: 2,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  completionBadge: {
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  badgeTitle: {
    fontSize: 24,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
  },
  congratsText: {
    fontSize: 20,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  messageText: {
    fontSize: 16,
    fontFamily: theme.fonts.body,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  scoreContainer: {
    marginBottom: theme.spacing.xl,
  },
  scoreCard: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  scoreLabel: {
    fontSize: 18,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
  },
  scoreValue: {
    fontSize: 48,
    fontFamily: theme.fonts.heading,
    marginBottom: theme.spacing.md,
  },
  scoreBar: {
    width: '100%',
    alignItems: 'center',
  },
  scoreBarBg: {
    width: '80%',
    height: 12,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: theme.borderRadius.sm,
  },
  statsContainer: {
    marginBottom: theme.spacing.xl,
  },
  statsTitle: {
    fontSize: 20,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    textAlign: 'center',
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
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.tertiary,
  },
  statIcon: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  statValue: {
    fontSize: 20,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  statTitle: {
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  journeyContainer: {
    marginBottom: theme.spacing.xl,
  },
  journeyTitle: {
    fontSize: 20,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  journeySteps: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    gap: theme.spacing.md,
  },
  journeyStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 16,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  stepDescription: {
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
  },
  stepCheck: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accent.green + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsContainer: {
    gap: theme.spacing.md,
  },
  actionButton: {
    marginBottom: theme.spacing.md,
  },
  shareButton: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  shareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  shareButtonText: {
    fontSize: 16,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.accent.cyan,
  },
  bottomSpacing: {
    height: 20,
  },
});