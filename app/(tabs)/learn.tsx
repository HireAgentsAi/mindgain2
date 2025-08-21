import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { 
  BookOpen, 
  Target, 
  Play, 
  Star, 
  Crown, 
  Brain,
  Trophy,
  Clock,
  Users,
  Award,
} from 'lucide-react-native';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { theme } from '@/constants/theme';
import { SupabaseService } from '@/utils/supabaseService';
import ContentGenerationModal from '@/components/ui/ContentGenerationModal';

const { width } = Dimensions.get('window');

interface Subject {
  id: string;
  name: string;
  icon: any;
  color: string;
  progress: number;
  totalTopics: number;
  completedTopics: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  examples?: string[];
  icon: any;
  color: string;
  onPress: () => void;
}

export default function Learn() {
  const isMounted = useRef(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userProgress, setUserProgress] = useState({
    totalXP: 3450,
    currentLevel: 12,
    streakDays: 15,
    completedLessons: 87,
  });
  const [showTextModal, setShowTextModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fadeIn = useSharedValue(0);

  useEffect(() => {
    isMounted.current = true;
    loadSubjects();
    fadeIn.value = withTiming(1, { duration: 800 });
    
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadSubjects = async () => {
    try {
      if (!isMounted.current) return;
      
      // Check authentication
      const user = await SupabaseService.getCurrentUser();
      if (!user) {
        if (!isMounted.current) return;
        router.replace('/auth');
        return;
      }

      // Load real subjects from database
      const indianSubjects = await SupabaseService.getIndianSubjects();
      
      // Convert to Subject format with progress
      const subjectsWithProgress = await Promise.all(
        indianSubjects.map(async (subject) => {
          const progress = await SupabaseService.getSubjectProgress(user.id, subject.id);
          return {
            id: subject.id,
            name: subject.name,
            icon: BookOpen, // Default icon
            color: subject.color,
            progress: progress.average_score,
            totalTopics: subject.total_topics,
            completedTopics: progress.topics_attempted,
            difficulty: progress.proficiency_level as any,
          };
        })
      );
      
      if (!isMounted.current) return;
      setSubjects(subjectsWithProgress);
    } catch (error) {
      console.error('Error loading subjects:', error);
      if (!isMounted.current) return;
      setSubjects([]);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSubjects().finally(() => {
      if (isMounted.current) {
        setRefreshing(false);
      }
    });
  };

  const handleCreateFromText = async (config: any) => {
    console.log('🎯 LEARN - handleCreateFromText called');
    console.log('📋 Received config:', config);
    
    try {
      setIsProcessing(true);
      console.log('⏳ Processing started...');
      
      // Check if user is authenticated
      const user = await SupabaseService.getCurrentUser();
      if (!user) {
        Alert.alert('Authentication Required', 'Please log in to create content.');
        return;
      }
      
      const missionData = {
        title: config.title || config.topic || 'Text-based Learning',
        description: config.description || (config.title ? `Learn about ${config.title}` : 'Custom text learning mission'),
        content_type: config.content_type || 'text',
        content_text: config.content_text || config.topic,
        subject_name: config.subject_name || config.subject || 'General',
        difficulty: config.difficulty || 'medium',
        contentType: config.contentType || 'general',
        examFocus: config.examFocus || 'general',
      };
      
      console.log('📦 Creating mission with data:', missionData);
      
      // Create mission from text content
      const result = await SupabaseService.createMission(missionData);
      console.log('✅ Mission created successfully:', result);
      
      const missionId = result?.id || result?.mission?.id;
      
      if (missionId) {
        setShowTextModal(false);
        
        // Navigate to content viewer with the mission ID
        console.log('🚀 Navigating to content viewer with ID:', missionId);
        
        // Small delay for smooth transition
        setTimeout(() => {
          router.push({
            pathname: '/learn/content-viewer',
            params: {
              contentId: missionId,
              contentType: 'text',
              source: 'smart-text',
            },
          });
        }, 500);
      } else {
        throw new Error('No mission ID returned from createMission');
      }
      
    } catch (error) {
      console.error('❌ Error creating text mission:', error);
      Alert.alert('Error', `Failed to create mission: ${(error as any)?.message || 'Unknown error'}`);
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
        console.log('⏹️ Processing finished');
      }
    }
  };

  const handleCreateFromYouTube = async (config: any) => {
    console.log('📺 LEARN - handleCreateFromYouTube called');
    console.log('📋 Received config:', config);
    
    try {
      setIsProcessing(true);
      console.log('⏳ Processing YouTube video...');
      
      // Check if user is authenticated
      const user = await SupabaseService.getCurrentUser();
      if (!user) {
        Alert.alert('Authentication Required', 'Please log in to create content.');
        return;
      }
      
      // Call YouTube processing edge function
      const result = await SupabaseService.callEdgeFunction('process-youtube', {
        youtube_url: config.youtube_url,
        title: config.title,
        description: config.description,
        subject_name: config.subject_name,
        difficulty: config.difficulty,
      });
      
      console.log('✅ YouTube processing result:', result);
      
      const missionId = result?.mission?.id;
      
      if (missionId) {
        setShowYouTubeModal(false);
        
        // Navigate to content viewer
        console.log('🚀 Navigating to content viewer with ID:', missionId);
        
        setTimeout(() => {
          router.push({
            pathname: '/learn/content-viewer',
            params: {
              contentId: missionId,
              contentType: 'youtube',
              source: 'youtube-video',
            },
          });
        }, 500);
      } else {
        throw new Error('No mission ID returned from YouTube processing');
      }
      
    } catch (error) {
      console.error('❌ Error processing YouTube video:', error);
      Alert.alert('Error', `Failed to process video: ${(error as any)?.message || 'Unknown error'}`);
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
        console.log('⏹️ YouTube processing finished');
      }
    }
  };

  const quickActions: QuickAction[] = [
    {
      id: 'daily',
      title: 'Daily Quiz',
      subtitle: 'Quick 10-question challenge',
      icon: 'play-circle',
      color: theme.colors.accent.purple,
      onPress: () => router.push('/quiz/daily'),
    },
    {
      id: 'smart-text',
      title: 'Smart Text',
      subtitle: 'Transform any text into structured lessons',
      examples: ['Study notes', 'Research papers', 'Articles'],
      icon: 'edit',
      color: theme.colors.accent.green,
      onPress: () => setShowTextModal(true),
    },
  ];

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ translateY: interpolate(fadeIn.value, [0, 1], [30, 0]) }],
  }));

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'expert': return theme.colors.accent.pink;
      case 'advanced': return theme.colors.accent.yellow;
      case 'intermediate': return theme.colors.accent.blue;
      case 'beginner': return theme.colors.accent.green;
      default: return theme.colors.text.muted;
    }
  };

  const SubjectCard = ({ subject }: { subject: Subject }) => {
    const IconComponent = subject.icon;
    
    return (
      <TouchableOpacity
        style={styles.subjectCard}
        onPress={() => router.push(`/quiz/subject?id=${subject.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.subjectHeader}>
          <View style={[styles.subjectIcon, { backgroundColor: subject.color + '20' }]}>
            <IconComponent size={24} color={subject.color} />
          </View>
          <View style={styles.subjectInfo}>
            <Text style={[styles.subjectName, { color: theme.colors.text.primary }]}>
              {subject.name}
            </Text>
            <Text style={[styles.subjectProgress, { color: theme.colors.text.secondary }]}>
              {subject.completedTopics}/{subject.totalTopics} topics
            </Text>
          </View>
          <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(subject.difficulty) + '20' }]}>
            <Text style={[styles.difficultyText, { color: getDifficultyColor(subject.difficulty) }]}>
              {subject.difficulty}
            </Text>
          </View>
        </View>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[
              styles.progressFill, 
              { 
                width: `${subject.progress}%`,
                backgroundColor: subject.color
              }
            ]} />
          </View>
          <Text style={[styles.progressPercent, { color: subject.color }]}>
            {subject.progress}%
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const QuickActionCard = ({ action }: { action: QuickAction }) => {
    
    return (
      <TouchableOpacity
        style={styles.actionCard}
        onPress={action.onPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[action.color, action.color + '80']}
          style={styles.actionGradient}
        >
          <View style={styles.actionTop}>
            <View style={styles.actionIcon}>
              <FontAwesome5 name={action.icon} size={18} color="#ffffff" solid />
            </View>
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>{action.title}</Text>
            <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
          </View>
          {action.examples && (
            <View style={styles.actionExamples}>
              {action.examples.slice(0, 2).map((example, index) => (
                <Text key={index} style={styles.actionExample}>• {example}</Text>
              ))}
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.background.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <LinearGradient
            colors={[theme.colors.accent.purple, theme.colors.accent.blue]}
            style={styles.headerIcon}
          >
            <FontAwesome5 name="graduation-cap" size={20} color={theme.colors.text.primary} solid />
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Learn</Text>
            <Text style={styles.headerSubtitle}>Explore subjects & topics</Text>
          </View>
        </View>
      </View>

      {/* Progress Overview */}
      <View style={styles.progressOverview}>
        <LinearGradient
          colors={[theme.colors.accent.purple, theme.colors.accent.purpleLight]}
          style={styles.progressGradient}
        >
          <View style={styles.progressStats}>
            <View style={styles.statItem}>
              <FontAwesome5 name="crown" size={16} color="#ffffff" solid />
              <Text style={styles.statValue}>Level {userProgress.currentLevel}</Text>
            </View>
            <View style={styles.statItem}>
              <FontAwesome5 name="trophy" size={16} color="#ffffff" solid />
              <Text style={styles.statValue}>{userProgress.totalXP} XP</Text>
            </View>
            <View style={styles.statItem}>
              <FontAwesome5 name="medal" size={16} color="#ffffff" solid />
              <Text style={styles.statValue}>{userProgress.streakDays} day streak</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

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
        >
          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
              Learning Tools
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.text.secondary }]}>
              Process content and test your knowledge
            </Text>
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action) => (
                <QuickActionCard key={action.id} action={action} />
              ))}
            </View>
          </View>

          {/* Subjects */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
              Subjects
            </Text>
            <View style={styles.subjectsContainer}>
              {subjects.map((subject) => (
                <SubjectCard key={subject.id} subject={subject} />
              ))}
            </View>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Text Input Modal */}
      {showTextModal && (
        <ContentGenerationModal
          visible={showTextModal}
          onClose={() => setShowTextModal(false)}
          onGenerate={handleCreateFromText}
          contentType="text"
          isLoading={isProcessing}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.button,
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
  
  progressOverview: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  
  progressGradient: {
    padding: theme.spacing.lg,
  },
  
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  
  statItem: {
    alignItems: 'center',
    gap: 6,
  },
  
  statValue: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: theme.fonts.subheading,
  },
  
  content: {
    flex: 1,
  },
  
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },

  sectionSubtitle: {
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    marginBottom: theme.spacing.lg,
  },
  
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  
  actionCard: {
    width: (width - theme.spacing.lg * 2 - theme.spacing.sm) / 2,
    height: 130,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.sm,
    marginBottom: theme.spacing.sm,
  },
  
  actionGradient: {
    padding: theme.spacing.md,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'space-between',
  },

  actionTop: {
    alignItems: 'center',
  },
  
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  actionContent: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: theme.spacing.xs,
  },
  
  actionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  
  actionSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 4,
  },

  actionExamples: {
    alignItems: 'center',
  },

  actionExample: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 8,
    textAlign: 'center',
    marginBottom: 1,
  },
  
  subjectsContainer: {
    gap: theme.spacing.md,
  },
  
  subjectCard: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  
  subjectIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  
  subjectInfo: {
    flex: 1,
  },
  
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  
  subjectProgress: {
    fontSize: 14,
  },
  
  difficultyBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  
  difficultyText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: theme.colors.border.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  
  progressPercent: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
});