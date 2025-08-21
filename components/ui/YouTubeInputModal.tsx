import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Youtube, Sparkles, BookOpen, Target, Clock } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import GradientButton from './GradientButton';

interface YouTubeInputModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (config: any) => void;
  isLoading?: boolean;
}

const examTypes = [
  { id: 'upsc', title: 'UPSC', color: theme.colors.accent.purple },
  { id: 'ssc', title: 'SSC', color: theme.colors.accent.blue },
  { id: 'banking', title: 'Banking', color: theme.colors.accent.green },
  { id: 'jee_neet', title: 'JEE/NEET', color: theme.colors.accent.yellow },
  { id: 'state_pcs', title: 'State PCS', color: theme.colors.accent.pink },
  { id: 'general', title: 'General', color: theme.colors.accent.cyan },
];

const subjects = [
  'History', 'Polity', 'Geography', 'Economy', 
  'Science & Technology', 'Current Affairs', 'Mathematics',
  'Physics', 'Chemistry', 'Biology', 'English', 'General Studies'
];

export default function YouTubeInputModal(props: YouTubeInputModalProps) {
  const { visible, onClose, onGenerate, isLoading } = props;
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('General Studies');
  const [selectedExam, setSelectedExam] = useState('general');
  const [difficulty, setDifficulty] = useState('medium');

  const handleGenerate = async () => {
    console.log('🚀 YOUTUBE MODAL - handleGenerate called');
    
    if (!youtubeUrl.trim()) {
      Alert.alert('Missing URL', 'Please enter a YouTube video URL.');
      return;
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(youtubeUrl.trim())) {
      Alert.alert('Invalid URL', 'Please enter a valid YouTube URL.');
      return;
    }

    const config = {
      youtube_url: youtubeUrl.trim(),
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      subject_name: selectedSubject,
      exam_focus: selectedExam,
      difficulty,
    };

    console.log('📦 YouTube config created:', config);
    
    try {
      await onGenerate(config);
      
      // Reset form
      setYoutubeUrl('');
      setTitle('');
      setDescription('');
      setSelectedSubject('General Studies');
      setSelectedExam('general');
      setDifficulty('medium');
      
    } catch (error) {
      console.error('Error in YouTube modal:', error);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modalContainer} onPress={() => {}}>
          <LinearGradient
            colors={[theme.colors.background.card, theme.colors.background.secondary]}
            style={styles.modal}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <Youtube size={24} color={theme.colors.accent.pink} />
                <Text style={styles.headerTitle}>YouTube Video Processor</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.content} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContainer}
            >
              {/* YouTube URL Input */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📺 YouTube Video URL</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="https://youtube.com/watch?v=..."
                  placeholderTextColor={theme.colors.text.tertiary}
                  value={youtubeUrl}
                  onChangeText={setYoutubeUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              {/* Optional Title */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📝 Custom Title (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., Indian Constitution Explained"
                  placeholderTextColor={theme.colors.text.tertiary}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              {/* Subject Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📚 Subject</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.subjectsContainer}
                >
                  {subjects.map((subject) => (
                    <TouchableOpacity
                      key={subject}
                      style={[
                        styles.subjectChip,
                        selectedSubject === subject && styles.selectedSubject,
                      ]}
                      onPress={() => setSelectedSubject(subject)}
                    >
                      <Text style={[
                        styles.subjectText,
                        selectedSubject === subject && styles.selectedSubjectText,
                      ]}>
                        {subject}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Exam Focus */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎯 Exam Focus</Text>
                <View style={styles.examTypesContainer}>
                  {examTypes.map((exam) => (
                    <TouchableOpacity
                      key={exam.id}
                      style={[
                        styles.examTypeChip,
                        selectedExam === exam.id && styles.selectedExamType,
                        { borderColor: selectedExam === exam.id ? exam.color : theme.colors.border.tertiary }
                      ]}
                      onPress={() => setSelectedExam(exam.id)}
                    >
                      <Text style={[
                        styles.examTypeText,
                        { color: selectedExam === exam.id ? exam.color : theme.colors.text.secondary }
                      ]}>
                        {exam.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Difficulty */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⚡ Difficulty Level</Text>
                <View style={styles.difficultyContainer}>
                  {['easy', 'medium', 'hard'].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.difficultyChip,
                        difficulty === level && styles.selectedDifficulty,
                      ]}
                      onPress={() => setDifficulty(level)}
                    >
                      <Text style={[
                        styles.difficultyText,
                        difficulty === level && styles.selectedDifficultyText,
                      ]}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Features Info */}
              <View style={styles.featuresSection}>
                <Text style={styles.featuresTitle}>✨ What You'll Get:</Text>
                <View style={styles.featuresList}>
                  <View style={styles.featureItem}>
                    <BookOpen size={16} color={theme.colors.accent.purple} />
                    <Text style={styles.featureText}>Structured learning content from video</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Target size={16} color={theme.colors.accent.blue} />
                    <Text style={styles.featureText}>Interactive quiz questions</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Clock size={16} color={theme.colors.accent.green} />
                    <Text style={styles.featureText}>Flashcards for quick revision</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Sparkles size={16} color={theme.colors.accent.yellow} />
                    <Text style={styles.featureText}>Comprehensive test questions</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Generate Button */}
            <View style={styles.footer}>
              <GradientButton
                title={isLoading ? "Processing Video..." : "Process YouTube Video"}
                onPress={handleGenerate}
                size="large"
                fullWidth
                icon={isLoading ? 
                  <ActivityIndicator size={20} color={theme.colors.text.primary} /> :
                  <Youtube size={20} color={theme.colors.text.primary} />
                }
                colors={[theme.colors.accent.pink, theme.colors.accent.purple]}
                disabled={isLoading}
              />
            </View>
          </LinearGradient>
          
          {/* Loading Overlay */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <LinearGradient
                colors={[theme.colors.accent.pink + 'E6', theme.colors.accent.purple + 'E6']}
                style={styles.loadingContainer}
              >
                <View style={styles.loadingContent}>
                  <ActivityIndicator size={60} color={theme.colors.text.primary} />
                  <Text style={styles.loadingTitle}>Processing YouTube Video</Text>
                  <Text style={styles.loadingSubtitle}>
                    🎬 Extracting content{'\n'}
                    📝 Generating transcript{'\n'}
                    🧠 Creating learning materials
                  </Text>
                </View>
              </LinearGradient>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 600,
    height: '85%',
    maxHeight: 700,
  },
  modal: {
    flex: 1,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
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
    fontSize: 20,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    padding: theme.spacing.lg,
    flexGrow: 1,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  textInput: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 16,
    fontFamily: theme.fonts.body,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.secondary,
  },
  subjectsContainer: {
    flexDirection: 'row',
  },
  subjectChip: {
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.tertiary,
  },
  selectedSubject: {
    backgroundColor: theme.colors.accent.purple + '20',
    borderColor: theme.colors.accent.purple,
  },
  subjectText: {
    fontSize: 14,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.secondary,
  },
  selectedSubjectText: {
    color: theme.colors.accent.purple,
  },
  examTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  examTypeChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    backgroundColor: theme.colors.background.tertiary,
  },
  selectedExamType: {
    backgroundColor: theme.colors.background.primary,
  },
  examTypeText: {
    fontSize: 14,
    fontFamily: theme.fonts.subheading,
  },
  difficultyContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  difficultyChip: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.tertiary,
    borderWidth: 1,
    borderColor: theme.colors.border.tertiary,
    alignItems: 'center',
  },
  selectedDifficulty: {
    backgroundColor: theme.colors.accent.blue + '20',
    borderColor: theme.colors.accent.blue,
  },
  difficultyText: {
    fontSize: 14,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.secondary,
  },
  selectedDifficultyText: {
    color: theme.colors.accent.blue,
  },
  featuresSection: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.secondary,
  },
  featuresTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  featuresList: {
    gap: theme.spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  featureText: {
    fontSize: 14,
    fontFamily: theme.fonts.body,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  footer: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.tertiary,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    width: '90%',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  loadingContent: {
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  loadingTitle: {
    fontSize: 22,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  loadingSubtitle: {
    fontSize: 16,
    fontFamily: theme.fonts.body,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});