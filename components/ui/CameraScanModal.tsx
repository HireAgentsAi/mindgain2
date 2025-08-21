import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Pressable,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Camera, RotateCcw, Check, Zap, BookOpen, Target, Clock } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import GradientButton from './GradientButton';

interface CameraScanModalProps {
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

export default function CameraScanModal(props: CameraScanModalProps) {
  const { visible, onClose, onGenerate, isLoading } = props;
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('General Studies');
  const [selectedExam, setSelectedExam] = useState('general');
  const [difficulty, setDifficulty] = useState('medium');
  const cameraRef = useRef<CameraView>(null);

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      if (photo?.base64) {
        setCapturedImage(photo.base64);
        setShowConfig(true);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture');
    }
  };

  const handleGenerate = async () => {
    if (!capturedImage) return;

    const config = {
      image_base64: capturedImage,
      title: title.trim() || `Scanned Notes - ${new Date().toLocaleDateString()}`,
      subject_name: selectedSubject,
      exam_focus: selectedExam,
      difficulty,
    };

    await onGenerate(config);
    
    // Reset form
    setCapturedImage(null);
    setShowConfig(false);
    setTitle('');
    setSelectedSubject('General Studies');
    setSelectedExam('general');
    setDifficulty('medium');
  };

  const retakePicture = () => {
    setCapturedImage(null);
    setShowConfig(false);
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  if (!visible) return null;

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>Camera Permission</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.content}>
              <Camera size={64} color={theme.colors.accent.green} style={styles.icon} />
              <Text style={styles.description}>
                We need camera permission to scan your study materials and convert them into interactive learning missions.
              </Text>
              <GradientButton
                title="Grant Camera Permission"
                onPress={requestPermission}
                colors={[theme.colors.accent.green, theme.colors.accent.cyan]}
              />
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.fullScreenOverlay}>
        {showConfig ? (
          // Configuration Screen
          <View style={styles.configContainer}>
            <LinearGradient
              colors={[theme.colors.background.card, theme.colors.background.secondary]}
              style={styles.configModal}
            >
              <View style={styles.header}>
                <Text style={styles.title}>Configure Scan</Text>
                <TouchableOpacity onPress={retakePicture} style={styles.closeButton}>
                  <RotateCcw size={24} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.configContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.configDescription}>
                  ✅ Image captured! Configure your learning mission:
                </Text>

                {/* Custom Title */}
                <View style={styles.configSection}>
                  <Text style={styles.configSectionTitle}>📝 Title (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., Chemistry Notes Chapter 5"
                    placeholderTextColor={theme.colors.text.tertiary}
                    value={title}
                    onChangeText={setTitle}
                  />
                </View>

                {/* Subject Selection */}
                <View style={styles.configSection}>
                  <Text style={styles.configSectionTitle}>📚 Subject</Text>
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
                <View style={styles.configSection}>
                  <Text style={styles.configSectionTitle}>🎯 Exam Focus</Text>
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

                {/* Features Info */}
                <View style={styles.featuresSection}>
                  <Text style={styles.featuresTitle}>✨ What You'll Get:</Text>
                  <View style={styles.featuresList}>
                    <View style={styles.featureItem}>
                      <BookOpen size={16} color={theme.colors.accent.purple} />
                      <Text style={styles.featureText}>OCR text extraction from your notes</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Target size={16} color={theme.colors.accent.blue} />
                      <Text style={styles.featureText}>Interactive quiz questions</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Clock size={16} color={theme.colors.accent.green} />
                      <Text style={styles.featureText}>Flashcards for memorization</Text>
                    </View>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.configFooter}>
                <GradientButton
                  title={isLoading ? "Processing..." : "Process Scanned Content"}
                  onPress={handleGenerate}
                  size="large"
                  fullWidth
                  icon={isLoading ? 
                    <ActivityIndicator size={20} color={theme.colors.text.primary} /> :
                    <Zap size={20} color={theme.colors.text.primary} />
                  }
                  colors={[theme.colors.accent.green, theme.colors.accent.cyan]}
                  disabled={isLoading}
                />
              </View>
            </LinearGradient>
          </View>
        ) : (
          // Camera Screen
          <>
            <View style={styles.cameraHeader}>
              <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                <X size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.cameraTitle}>Scan Study Material</Text>
              <TouchableOpacity onPress={toggleCameraFacing} style={styles.headerButton}>
                <RotateCcw size={24} color="white" />
              </TouchableOpacity>
            </View>

            <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
              <View style={styles.cameraOverlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanInstruction}>
                  Position text within the frame for best OCR results
                </Text>
              </View>
            </CameraView>

            <View style={styles.cameraControls}>
              <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <LinearGradient
              colors={[theme.colors.accent.green + 'E6', theme.colors.accent.cyan + 'E6']}
              style={styles.loadingContainer}
            >
              <View style={styles.loadingContent}>
                <ActivityIndicator size={60} color={theme.colors.text.primary} />
                <Text style={styles.loadingTitle}>Processing Scanned Content</Text>
                <Text style={styles.loadingSubtitle}>
                  📸 Extracting text with OCR{'\n'}
                  🧠 Analyzing content structure{'\n'}
                  ✨ Creating learning materials
                </Text>
              </View>
            </LinearGradient>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'black',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.tertiary,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  title: {
    fontSize: 20,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
  },
  cameraTitle: {
    fontSize: 18,
    fontFamily: theme.fonts.heading,
    color: 'white',
  },
  closeButton: {
    padding: 4,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  icon: {
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    fontFamily: theme.fonts.body,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 300,
    height: 200,
    borderWidth: 2,
    borderColor: theme.colors.accent.green,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  scanInstruction: {
    color: 'white',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: theme.colors.accent.green,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.accent.green,
  },
  configContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  configModal: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  configContent: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  configDescription: {
    fontSize: 16,
    fontFamily: theme.fonts.body,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  configSection: {
    marginBottom: theme.spacing.xl,
  },
  configSectionTitle: {
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
    backgroundColor: theme.colors.accent.green + '20',
    borderColor: theme.colors.accent.green,
  },
  subjectText: {
    fontSize: 14,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.secondary,
  },
  selectedSubjectText: {
    color: theme.colors.accent.green,
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
  configFooter: {
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