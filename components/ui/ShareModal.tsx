import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Share2, Trophy, Clock, Target } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import GradientButton from './GradientButton';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'score' | 'achievement' | 'mission';
  score?: {
    percentage: number;
    subject: string;
    timeSpent: number;
  };
  achievement?: {
    name: string;
    description: string;
    icon: string;
  };
  mission?: {
    title: string;
    completionTime: number;
    score: number;
  };
}

export default function ShareModal({
  visible,
  onClose,
  type,
  score,
  achievement,
  mission,
}: ShareModalProps) {
  const handleShare = async () => {
    try {
      let shareText = '';
      
      switch (type) {
        case 'score':
          if (score) {
            shareText = `🏆 Just scored ${score.percentage}% on ${score.subject}!

⏱️ Completed in ${Math.round(score.timeSpent / 60)} minutes
📚 Studying with MindGains AI - India's #1 learning platform

Join me in mastering competitive exams:
📱 Download: https://mindgains.ai

#MindGainsAI #CompetitiveExams #StudySuccess`;
          }
          break;
          
        case 'achievement':
          if (achievement) {
            shareText = `🎉 Achievement Unlocked: ${achievement.name}!

${achievement.description}

Leveling up my knowledge with MindGains AI! 🚀

Join India's smartest students:
📱 Download: https://mindgains.ai

#MindGainsAI #Achievement #LearningJourney`;
          }
          break;
          
        case 'mission':
          if (mission) {
            shareText = `✅ Mission Complete: ${mission.title}

🎯 Score: ${mission.score}%
⏱️ Time: ${Math.round(mission.completionTime / 60)} minutes

Mastering topics with AI-powered learning! 🧠

Transform your exam prep:
📱 Download: https://mindgains.ai

#MindGainsAI #MissionComplete #AILearning`;
          }
          break;
      }

      if (shareText) {
        await Share.share({
          message: shareText,
          title: 'MindGains AI Progress',
        });
        onClose();
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share. Please try again.');
    }
  };

  const getModalTitle = () => {
    switch (type) {
      case 'score': return 'Share Your Score';
      case 'achievement': return 'Share Achievement';
      case 'mission': return 'Share Mission';
      default: return 'Share Progress';
    }
  };

  const getModalIcon = () => {
    switch (type) {
      case 'score': return <Trophy size={24} color={theme.colors.accent.yellow} />;
      case 'achievement': return <Target size={24} color={theme.colors.accent.purple} />;
      case 'mission': return <Clock size={24} color={theme.colors.accent.green} />;
      default: return <Share2 size={24} color={theme.colors.accent.blue} />;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={[theme.colors.background.card, theme.colors.background.secondary]}
            style={styles.modal}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                {getModalIcon()}
                <Text style={styles.headerTitle}>{getModalTitle()}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              {type === 'score' && score && (
                <View style={styles.scorePreview}>
                  <Text style={styles.scoreValue}>{score.percentage}%</Text>
                  <Text style={styles.scoreSubject}>{score.subject}</Text>
                  <Text style={styles.scoreTime}>
                    Completed in {Math.round(score.timeSpent / 60)} minutes
                  </Text>
                </View>
              )}

              {type === 'achievement' && achievement && (
                <View style={styles.achievementPreview}>
                  <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                  <Text style={styles.achievementName}>{achievement.name}</Text>
                  <Text style={styles.achievementDescription}>{achievement.description}</Text>
                </View>
              )}

              {type === 'mission' && mission && (
                <View style={styles.missionPreview}>
                  <Text style={styles.missionTitle}>{mission.title}</Text>
                  <View style={styles.missionStats}>
                    <Text style={styles.missionScore}>Score: {mission.score}%</Text>
                    <Text style={styles.missionTime}>
                      Time: {Math.round(mission.completionTime / 60)}m
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.shareDescription}>
                Share your progress and inspire others to join India's learning revolution!
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <GradientButton
                title="Share Progress"
                onPress={handleShare}
                size="large"
                fullWidth
                icon={<Share2 size={20} color={theme.colors.text.primary} />}
                colors={[theme.colors.accent.purple, theme.colors.accent.blue]}
              />
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  modal: {
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.tertiary,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  scorePreview: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  scoreValue: {
    fontSize: 48,
    fontFamily: theme.fonts.heading,
    color: theme.colors.accent.green,
  },
  scoreSubject: {
    fontSize: 18,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.primary,
  },
  scoreTime: {
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
  },
  achievementPreview: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  achievementIcon: {
    fontSize: 48,
  },
  achievementName: {
    fontSize: 20,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  achievementDescription: {
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  missionPreview: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  missionTitle: {
    fontSize: 18,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  missionStats: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  missionScore: {
    fontSize: 16,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.accent.green,
  },
  missionTime: {
    fontSize: 16,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.accent.blue,
  },
  shareDescription: {
    fontSize: 14,
    fontFamily: theme.fonts.body,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    padding: theme.spacing.lg,
  },
});