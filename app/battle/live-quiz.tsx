import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
  interpolate,
  Easing,
} from 'react-native-reanimated';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { theme } from '@/constants/theme';
import MascotAvatar from '@/components/ui/MascotAvatar';
import GradientButton from '@/components/ui/GradientButton';
import { SupabaseService } from '@/utils/supabaseService';

const { width = 375 } = Dimensions.get('window') || {};

interface LiveQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
}

interface BattlePlayer {
  id: string;
  user_id: string;
  full_name: string;
  score: number;
  current_answer?: number;
  answered_at?: string;
  is_current_user?: boolean;
}

export default function LiveQuizScreen() {
  const isMounted = useRef(true);
  const params = useLocalSearchParams();
  const { roomId, topic, subject } = params;
  
  const [questions, setQuestions] = useState<LiveQuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [players, setPlayers] = useState<BattlePlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [winner, setWinner] = useState<BattlePlayer | null>(null);
  const [battleComplete, setBattleComplete] = useState(false);

  // Animation values
  const questionOpacity = useSharedValue(0);
  const questionScale = useSharedValue(0.9);
  const timerPulse = useSharedValue(1);
  const playersOpacity = useSharedValue(0);
  const answerScale = useSharedValue(1);
  const battleGlow = useSharedValue(0);

  useEffect(() => {
    isMounted.current = true;
    loadLiveQuiz();
    startAnimations();
    
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (timeLeft > 0 && !showResults) {
      const timer = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      
      // Timer pulse animation when time is running low
      if (timeLeft <= 10) {
        timerPulse.value = withSequence(
          withTiming(1.2, { duration: 200 }),
          withTiming(1, { duration: 200 })
        );
      }
      
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !showResults) {
      handleTimeUp();
    }
  }, [timeLeft, showResults]);

  const startAnimations = () => {
    questionOpacity.value = withTiming(1, { duration: 600 });
    questionScale.value = withSpring(1, { damping: 15, stiffness: 100 });
    playersOpacity.value = withDelay(300, withTiming(1, { duration: 600 }));
    
    // Battle glow effect
    battleGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  };

  const loadLiveQuiz = async () => {
    try {
      if (!isMounted.current) return;
      
      const user = await SupabaseService.getCurrentUser();
      if (!user) {
        if (!isMounted.current) return;
        router.replace('/auth');
        return;
      }

      // Get real battle room data
      const battleRoomData = await SupabaseService.getBattleRoomDetails(roomId as string);
      
      if (!battleRoomData.room) {
        throw new Error('Battle room not found');
      }

      // Get questions from battle room
      const battleQuestions = battleRoomData.room.questions || [];
      if (battleQuestions.length === 0) {
        throw new Error('No questions available for this battle');
      }

      // Get real players from participants
      const realPlayers: BattlePlayer[] = battleRoomData.participants.map((participant: any) => ({
        id: participant.id,
        user_id: participant.user_id,
        full_name: participant.profiles?.full_name || 'Player',
        score: participant.current_score || 0,
        is_current_user: participant.user_id === user.id,
      }));
      
      if (!isMounted.current) return;
      setQuestions(battleQuestions);
      setPlayers(realPlayers);
    } catch (error) {
      console.error('Error loading live quiz:', error);
      if (!isMounted.current) return;
      Alert.alert('Error', 'Failed to load battle data. Please try again.');
      router.back();
    } finally {
      if (!isMounted.current) return;
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (selectedAnswer !== null || showResults) return;
    
    setSelectedAnswer(answerIndex);
    
    // Answer selection animation
    answerScale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 200 })
    );
    
    // Simulate other players answering
    setTimeout(() => {
      simulateOtherPlayersAnswers();
    }, 500);
  };

  const simulateOtherPlayersAnswers = () => {
    setPlayers(prev => prev.map(player => {
      if (player.is_current_user) {
        return {
          ...player,
          current_answer: selectedAnswer,
          answered_at: new Date().toISOString(),
        };
      } else {
        // Simulate AI players answering
        const randomAnswer = Math.floor(Math.random() * 4);
        const isCorrect = randomAnswer === questions[currentQuestionIndex].correct_answer;
        const responseTime = 5 + Math.random() * 20; // 5-25 seconds
        
        return {
          ...player,
          current_answer: randomAnswer,
          answered_at: new Date(Date.now() - responseTime * 1000).toISOString(),
          score: player.score + (isCorrect ? questions[currentQuestionIndex].points : 0),
        };
      }
    }));
    
    // Show results after a short delay
    setTimeout(() => {
      setShowResults(true);
      updateCurrentUserScore();
    }, 1000);
  };

  const updateCurrentUserScore = () => {
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correct_answer;
    
    setPlayers(prev => prev.map(player => {
      if (player.is_current_user) {
        return {
          ...player,
          score: player.score + (isCorrect ? currentQuestion.points : 0),
        };
      }
      return player;
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResults(false);
      setTimeLeft(30);
      
      // Reset animations
      questionOpacity.value = withTiming(0, { duration: 200 });
      setTimeout(() => {
        questionOpacity.value = withTiming(1, { duration: 400 });
        questionScale.value = withSpring(1, { damping: 15, stiffness: 100 });
      }, 200);
    } else {
      completeBattle();
    }
  };

  const handleTimeUp = () => {
    if (selectedAnswer === null) {
      // Auto-select random answer if time runs out
      const randomAnswer = Math.floor(Math.random() * 4);
      setSelectedAnswer(randomAnswer);
      simulateOtherPlayersAnswers();
    }
  };

  const completeBattle = () => {
    // Determine winner
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const battleWinner = sortedPlayers[0];
    
    setWinner(battleWinner);
    setBattleComplete(true);
    
    // Navigate to results screen
    setTimeout(() => {
      router.push({
        pathname: '/battle/results',
        params: {
          roomId: roomId as string,
          winnerId: battleWinner.id,
          winnerName: battleWinner.full_name,
          winnerScore: battleWinner.score.toString(),
          players: JSON.stringify(sortedPlayers),
          topic: topic as string,
          subject: subject as string,
        },
      });
    }, 2000);
  };

  const questionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: questionOpacity.value,
    transform: [{ scale: questionScale.value }],
  }));

  const playersAnimatedStyle = useAnimatedStyle(() => ({
    opacity: playersOpacity.value,
  }));

  const timerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: timerPulse.value }],
  }));

  const answerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: answerScale.value }],
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
          <Text style={styles.loadingText}>Preparing battle questions...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (battleComplete && winner) {
    return (
      <LinearGradient
        colors={[
          theme.colors.background.primary,
          theme.colors.background.secondary,
        ]}
        style={styles.container}
      >
        <View style={styles.winnerContainer}>
          <MascotAvatar size={120} animated={true} glowing={true} mood="celebrating" />
          
          <LinearGradient
            colors={[theme.colors.accent.gold, theme.colors.accent.yellow]}
            style={styles.winnerBadge}
          >
            <FontAwesome5 name="crown" size={32} color={theme.colors.text.primary} solid />
            <Text style={styles.winnerTitle}>Battle Champion!</Text>
          </LinearGradient>
          
          <Text style={styles.winnerName}>{winner.full_name}</Text>
          <Text style={styles.winnerScore}>{winner.score} points</Text>
          
          <Text style={styles.winnerMessage}>
            {winner.is_current_user 
              ? "🎉 Victory is yours! You dominated this battle! 🏆"
              : `${winner.full_name} conquered this battle! Better luck next time! 💪`
            }
          </Text>
        </View>
      </LinearGradient>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

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
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <FontAwesome5 name="fist-raised" size={20} color={theme.colors.accent.pink} solid />
          <Text style={styles.headerTitle}>LIVE BATTLE</Text>
        </View>
        
        <Animated.View style={[styles.timerContainer, timerAnimatedStyle, battleGlowAnimatedStyle]}>
          <LinearGradient
            colors={
              timeLeft <= 10 
                ? [theme.colors.accent.pink, '#ff4444']
                : [theme.colors.accent.blue, theme.colors.accent.cyan]
            }
            style={styles.timerGradient}
          >
            <FontAwesome5 name="clock" size={16} color={theme.colors.text.primary} solid />
            <Text style={styles.timerText}>{timeLeft}s</Text>
          </LinearGradient>
        </Animated.View>
        
        <View style={styles.headerRight}>
          <Text style={styles.questionCounter}>
            {currentQuestionIndex + 1}/{questions.length}
          </Text>
        </View>
      </View>

      {/* Live Players Bar */}
      <Animated.View style={[styles.playersBar, playersAnimatedStyle]}>
        <View style={styles.playersContainer}>
          {players.map((player, index) => (
            <LivePlayerCard
              key={player.id}
              player={player}
              index={index}
              hasAnswered={player.current_answer !== undefined}
            />
          ))}
        </View>
      </Animated.View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <LinearGradient
            colors={[theme.colors.accent.pink, theme.colors.accent.purple]}
            style={[styles.progressFill, { width: `${progress}%` }]}
          />
        </View>
        <Text style={styles.progressText}>Question {currentQuestionIndex + 1} of {questions.length}</Text>
      </View>

      {/* Question */}
      <Animated.View style={[styles.questionContainer, questionAnimatedStyle]}>
        <LinearGradient
          colors={[
            theme.colors.background.card,
            theme.colors.background.secondary,
          ]}
          style={styles.questionCard}
        >
          <View style={styles.questionHeader}>
            <Text style={styles.questionText}>{currentQuestion.question}</Text>
            <View style={styles.difficultyBadge}>
              <FontAwesome5 name="layer-group" size={12} color={theme.colors.accent.blue} />
              <Text style={styles.difficultyText}>{currentQuestion.difficulty}</Text>
            </View>
          </View>

          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option, index) => (
              <Animated.View key={index} style={answerAnimatedStyle}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    selectedAnswer === index && styles.selectedOption,
                    showResults && index === currentQuestion.correct_answer && styles.correctOption,
                    showResults && selectedAnswer === index && index !== currentQuestion.correct_answer && styles.incorrectOption,
                  ]}
                  onPress={() => handleAnswerSelect(index)}
                  disabled={selectedAnswer !== null}
                  activeOpacity={0.8}
                >
                  <View style={styles.optionContent}>
                    <View style={[
                      styles.optionNumber,
                      selectedAnswer === index && styles.selectedOptionNumber,
                      showResults && index === currentQuestion.correct_answer && styles.correctOptionNumber,
                    ]}>
                      <Text style={styles.optionNumberText}>
                        {String.fromCharCode(65 + index)}
                      </Text>
                    </View>
                    <Text style={styles.optionText}>{option}</Text>
                    
                    {showResults && index === currentQuestion.correct_answer && (
                      <FontAwesome5 name="check-circle" size={18} color={theme.colors.accent.green} solid />
                    )}
                    {showResults && selectedAnswer === index && index !== currentQuestion.correct_answer && (
                      <FontAwesome5 name="times-circle" size={18} color={theme.colors.accent.pink} solid />
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          {showResults && (
            <View style={styles.explanationContainer}>
              <View style={styles.explanationHeader}>
                <FontAwesome5 name="lightbulb" size={16} color={theme.colors.accent.yellow} solid />
                <Text style={styles.explanationTitle}>Explanation</Text>
              </View>
              <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        {showResults ? (
          <GradientButton
            title={currentQuestionIndex < questions.length - 1 ? "Next Question" : "View Results"}
            onPress={handleNextQuestion}
            size="large"
            fullWidth
            icon={<FontAwesome5 name="arrow-right" size={16} color={theme.colors.text.primary} solid />}
            colors={[theme.colors.accent.green, theme.colors.accent.cyan]}
          />
        ) : (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>
              {selectedAnswer !== null 
                ? "Waiting for other players..." 
                : "Select your answer!"
              }
            </Text>
            {selectedAnswer !== null && (
              <View style={styles.answeredIndicator}>
                <FontAwesome5 name="check-circle" size={16} color={theme.colors.accent.green} solid />
                <Text style={styles.answeredText}>Answer submitted!</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

function LivePlayerCard({ player, index, hasAnswered }: {
  player: BattlePlayer;
  index: number;
  hasAnswered: boolean;
}) {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);
  const answerPulse = useSharedValue(1);

  useEffect(() => {
    setTimeout(() => {
      opacity.value = withTiming(1, { duration: 400 });
      scale.value = withSpring(1, { damping: 15, stiffness: 100 });
    }, index * 150);
  }, [index]);

  useEffect(() => {
    if (hasAnswered) {
      answerPulse.value = withSequence(
        withTiming(1.2, { duration: 200 }),
        withTiming(1, { duration: 200 })
      );
    }
  }, [hasAnswered]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value * answerPulse.value }],
  }));

  return (
    <Animated.View style={[styles.livePlayerCard, animatedStyle]}>
      <LinearGradient
        colors={
          player.is_current_user
            ? [theme.colors.accent.purple + '40', theme.colors.accent.purple + '20']
            : [theme.colors.background.card, theme.colors.background.secondary]
        }
        style={styles.livePlayerGradient}
      >
        <View style={styles.livePlayerAvatar}>
          <Text style={styles.livePlayerAvatarText}>
            {player.full_name.charAt(0)}
          </Text>
          
          {hasAnswered && (
            <View style={styles.answeredBadge}>
              <FontAwesome5 name="check" size={8} color={theme.colors.text.primary} solid />
            </View>
          )}
        </View>
        
        <Text style={styles.livePlayerName} numberOfLines={1}>
          {player.full_name}
        </Text>
        <Text style={styles.livePlayerScore}>{player.score}</Text>
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
  winnerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.md,
    ...theme.shadows.card,
  },
  winnerTitle: {
    fontSize: 24,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
  },
  winnerName: {
    fontSize: 28,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  winnerScore: {
    fontSize: 20,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.accent.green,
  },
  winnerMessage: {
    fontSize: 16,
    fontFamily: theme.fonts.body,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: theme.fonts.heading,
    color: theme.colors.accent.pink,
  },
  timerContainer: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    shadowColor: theme.colors.accent.blue,
  },
  timerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  timerText: {
    fontSize: 18,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  questionCounter: {
    fontSize: 14,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.secondary,
  },
  playersBar: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  playersContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  livePlayerCard: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  livePlayerGradient: {
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.tertiary,
    borderRadius: theme.borderRadius.md,
  },
  livePlayerAvatar: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accent.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    position: 'relative',
  },
  livePlayerAvatarText: {
    color: theme.colors.text.primary,
    fontSize: 12,
    fontFamily: theme.fonts.subheading,
  },
  answeredBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.accent.green,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background.card,
  },
  livePlayerName: {
    fontSize: 10,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 2,
  },
  livePlayerScore: {
    fontSize: 12,
    fontFamily: theme.fonts.heading,
    color: theme.colors.accent.yellow,
  },
  progressContainer: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.sm,
  },
  progressText: {
    fontSize: 12,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  questionContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  questionCard: {
    flex: 1,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    ...theme.shadows.card,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  questionText: {
    fontSize: 18,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text.primary,
    lineHeight: 26,
    flex: 1,
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent.blue + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
  },
  difficultyText: {
    fontSize: 10,
    fontFamily: theme.fonts.caption,
    color: theme.colors.accent.blue,
    textTransform: 'uppercase',
  },
  optionsContainer: {
    gap: theme.spacing.md,
  },
  optionButton: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.border.tertiary,
    overflow: 'hidden',
  },
  selectedOption: {
    borderColor: theme.colors.accent.purple,
    backgroundColor: theme.colors.accent.purple + '10',
  },
  correctOption: {
    borderColor: theme.colors.accent.green,
    backgroundColor: theme.colors.accent.green + '10',
  },
  incorrectOption: {
    borderColor: theme.colors.accent.pink,
    backgroundColor: theme.colors.accent.pink + '10',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  optionNumber: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedOptionNumber: {
    backgroundColor: theme.colors.accent.purple,
  },
  correctOptionNumber: {
    backgroundColor: theme.colors.accent.green,
  },
  optionNumberText: {
    fontSize: 14,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.tertiary,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontFamily: theme.fonts.body,
    color: theme.colors.text.primary,
    lineHeight: 22,
  },
  explanationContainer: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border.secondary,
    marginTop: theme.spacing.md,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  explanationTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.accent.yellow,
  },
  explanationText: {
    fontSize: 14,
    fontFamily: theme.fonts.caption,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
  actionContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  waitingContainer: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  waitingText: {
    fontSize: 16,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  answeredIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent.green + '20',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm,
  },
  answeredText: {
    fontSize: 14,
    fontFamily: theme.fonts.subheading,
    color: theme.colors.accent.green,
  },
});