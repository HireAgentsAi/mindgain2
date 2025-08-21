import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  Alert,
  TextInput,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Linking,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { theme } from '@/constants/theme';
import { router } from 'expo-router';
import { SupabaseService } from '@/utils/supabaseService';

const { width } = Dimensions.get('window');

interface BattleRoom {
  id: string;
  name: string;
  host_id: string;
  topic_id?: string;
  subject_name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  bet_amount: number;
  max_participants: number;
  current_participants: number;
  status: 'waiting' | 'active' | 'completed';
  room_code: string;
  created_at: string;
  profiles?: { full_name: string };
}

interface UserCoins {
  balance: number;
  total_earned: number;
  total_spent: number;
}

interface Topic {
  id: string;
  name: string;
  subject_id?: string;
  subject_name: string;
  category?: string;
  popularity?: number;
  examRelevance?: string;
  isCustom?: boolean;
}

interface UserSubscription {
  isPro: boolean;
  plan: string;
  dailyAiLimit: number;
  aiGenerationsUsed: number;
  battleLimit: number;
  battlesUsed: number;
}

export default function BattleScreen() {
  const [activeTab, setActiveTab] = useState<'quick' | 'rooms' | 'create' | 'friends'>('quick');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [battleRooms, setBattleRooms] = useState<BattleRoom[]>([]);
  const [userCoins, setUserCoins] = useState<UserCoins>({ balance: 5000, total_earned: 0, total_spent: 0 });
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [customTopic, setCustomTopic] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [selectedBetAmount, setSelectedBetAmount] = useState(100);
  const [roomName, setRoomName] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [userSubscription, setUserSubscription] = useState<UserSubscription>({
    isPro: false,
    plan: 'Free',
    dailyAiLimit: 3,
    aiGenerationsUsed: 0,
    battleLimit: 5,
    battlesUsed: 0
  });
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showModerationWarning, setShowModerationWarning] = useState(false);
  const [moderationResult, setModerationResult] = useState<any>(null);
  const [showMatchingModal, setShowMatchingModal] = useState(false);
  const [matchingStage, setMatchingStage] = useState<'searching' | 'coin-deduction' | 'opponent-found' | 'vs-screen' | 'generating-quiz' | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [opponentData, setOpponentData] = useState<any>(null);
  const [battleRoom, setBattleRoom] = useState<any>(null);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const coinsAnim = useRef(new Animated.Value(1)).current;

  const betAmounts = [50, 100, 200, 500, 1000];
  const difficulties = [
    { value: 'easy', label: 'Easy', color: theme.colors.accent.green },
    { value: 'medium', label: 'Medium', color: theme.colors.accent.yellow },
    { value: 'hard', label: 'Hard', color: theme.colors.gradient.error[0] },
  ];

  useEffect(() => {
    // Start animations
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    );

    pulseAnimation.start();
    glowAnimation.start();

    // Load data
    loadUserCoins();
    loadBattleRooms();
    loadTopics();
    loadUserSubscription();

    return () => {
      pulseAnimation.stop();
      glowAnimation.stop();
    };
  }, []);

  const loadUserCoins = async () => {
    try {
      const response = await SupabaseService.callEdgeFunction('battle-operations', {
        action: 'get_user_coins'
      });
      
      if (response) {
        setUserCoins(response);
      }
    } catch (error) {
      console.error('Error loading user coins:', error);
      // Set default coins for demo
      setUserCoins({ balance: 1000, total_earned: 1000, total_spent: 0 });
    }
  };

  const loadBattleRooms = async () => {
    try {
      const response = await SupabaseService.callEdgeFunction('battle-operations', {
        action: 'get_battle_rooms'
      });
      
      if (response) {
        setBattleRooms(response);
      }
    } catch (error) {
      console.error('Error loading battle rooms:', error);
    }
  };

  const loadTopics = async () => {
    try {
      // Load popular topics from AI service
      const popularResponse = await SupabaseService.callEdgeFunction('ai-battle-content', {
        action: 'get_popular_topics'
      });
      
      if (popularResponse) {
        const popularTopics = popularResponse.map((topic: any) => ({
          id: `popular_${topic.name.replace(/\s+/g, '_').toLowerCase()}`,
          name: topic.name,
          subject_name: topic.category,
          category: topic.category,
          popularity: topic.popularity,
          examRelevance: topic.examRelevance,
          isCustom: false
        }));
        setTopics(popularTopics);
      }

      // Also try to load database topics as fallback
      const dbResponse = await SupabaseService.getSubjectTopics();
      if (dbResponse && dbResponse.length > 0) {
        const dbTopics = dbResponse.map(topic => ({
          id: topic.id,
          name: topic.name,
          subject_id: topic.subject_id,
          subject_name: topic.indian_subjects?.name || 'General',
          isCustom: false
        }));
        
        // Merge with popular topics (avoid duplicates)
        setTopics(prev => {
          const existing = prev.map(t => t.name.toLowerCase());
          const newTopics = dbTopics.filter(t => !existing.includes(t.name.toLowerCase()));
          return [...prev, ...newTopics];
        });
      }
    } catch (error) {
      console.error('Error loading topics:', error);
      // Fallback topics
      setTopics([
        { id: 'history', name: 'Indian History', subject_name: 'History', isCustom: false },
        { id: 'polity', name: 'Indian Constitution', subject_name: 'Polity', isCustom: false },
        { id: 'geography', name: 'Geography of India', subject_name: 'Geography', isCustom: false },
        { id: 'current', name: 'Current Affairs', subject_name: 'Current Affairs', isCustom: false },
      ]);
    }
  };

  const loadUserSubscription = async () => {
    try {
      const response = await SupabaseService.callEdgeFunction('ai-battle-content', {
        action: 'check_subscription'
      });
      
      if (response) {
        setUserSubscription(response);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const animateCoins = () => {
    Animated.sequence([
      Animated.timing(coinsAnim, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(coinsAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const moderateCustomTopic = async (topic: string) => {
    try {
      const response = await SupabaseService.callEdgeFunction('ai-battle-content', {
        action: 'moderate_topic',
        topic: topic.trim()
      });

      if (!response.isAppropriate) {
        setModerationResult(response);
        setShowModerationWarning(true);
        return false;
      }

      // Topic is appropriate, optionally use enhanced version
      if (response.enhancedTopic && response.enhancedTopic !== topic) {
        setCustomTopic(response.enhancedTopic);
      }

      return true;
    } catch (error) {
      console.error('Moderation error:', error);
      return true; // Allow if moderation fails
    }
  };

  const createBattleRoom = async () => {
    // Check subscription limits first
    if (!userSubscription.isPro && userSubscription.battlesUsed >= userSubscription.battleLimit) {
      Alert.alert(
        'Daily Limit Reached',
        `You've reached your daily limit of ${userSubscription.battleLimit} battles. Upgrade to Pro for unlimited battles!`,
        [
          { text: 'Upgrade Now', onPress: () => setShowSubscriptionModal(true) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    const finalTopic = customTopic.trim() || selectedTopic?.name;
    
    if (!finalTopic) {
      Alert.alert('Error', 'Please select a topic or enter a custom topic');
      return;
    }
    
    if (!roomName.trim()) {
      Alert.alert('Error', 'Please enter a room name');
      return;
    }

    if (userCoins.balance < selectedBetAmount) {
      Alert.alert('Insufficient Coins', 'You don\'t have enough coins to place this bet');
      return;
    }

    // Check if using custom topic (Pro feature)
    const isCustomTopicUsed = customTopic.trim().length > 0;
    if (isCustomTopicUsed && !userSubscription.isPro) {
      Alert.alert(
        'Pro Feature',
        'Custom topics are a Pro feature. Please select from popular topics or upgrade to Pro.',
        [
          { text: 'Upgrade Now', onPress: () => setShowSubscriptionModal(true) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    // Moderate custom topic if provided
    if (isCustomTopicUsed) {
      const isTopicAppropriate = await moderateCustomTopic(customTopic);
      if (!isTopicAppropriate) {
        return; // Stop if topic is inappropriate
      }
    }

    setLoading(true);
    
    try {
      const response = await SupabaseService.callEdgeFunction('battle-operations', {
        action: 'create_battle_room',
        topic_id: selectedTopic?.id,
        subject_name: isCustomTopicUsed ? 'Custom Topic' : selectedTopic?.subject_name,
        difficulty: selectedDifficulty,
        bet_amount: selectedBetAmount,
        max_participants: 2,
        room_name: roomName.trim(),
        custom_topic: isCustomTopicUsed ? finalTopic : null
      });

      if (response) {
        setShowCreateModal(false);
        setRoomName('');
        setSelectedTopic(null);
        setCustomTopic('');
        animateCoins();
        await loadUserCoins();
        await loadBattleRooms();
        await loadUserSubscription(); // Refresh subscription data
        
        // Show invite options
        showInviteOptions(response.battleRoom);
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create battle room');
    } finally {
      setLoading(false);
    }
  };

  const joinBattleRoom = async (roomCode: string) => {
    const room = battleRooms.find(r => r.room_code === roomCode);
    if (!room) {
      Alert.alert('Error', 'Room not found');
      return;
    }

    if (userCoins.balance < room.bet_amount) {
      Alert.alert('Insufficient Coins', `You need ${room.bet_amount} coins to join this battle`);
      return;
    }

    Alert.alert(
      'Join Battle Room',
      `Join "${room.name}" with ${room.bet_amount} coins bet?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Join Battle', 
          onPress: async () => {
            setLoading(true);
            try {
              await SupabaseService.callEdgeFunction('battle-operations', {
                action: 'join_battle_room',
                room_code: roomCode
              });
              
              animateCoins();
              await loadUserCoins();
              await loadBattleRooms();
              
              Alert.alert('Success', 'Joined battle room! Get ready to battle!');
              router.push(`/battle/room?id=${room.id}`);
            } catch (error) {
              Alert.alert('Error', (error as any)?.message || 'Failed to join battle');
            } finally {
              setLoading(false);
            }
          }
        },
      ]
    );
  };

  const showInviteOptions = (battleRoom: any) => {
    Alert.alert(
      'Room Created!',
      `Room "${battleRoom.name}" created with code: ${battleRoom.room_code}\n\nInvite friends to join!`,
      [
        { text: 'Share via WhatsApp', onPress: () => inviteViaWhatsApp(battleRoom) },
        { text: 'Copy Room Code', onPress: () => copyRoomCode(battleRoom.room_code) },
        { text: 'OK', style: 'default' }
      ]
    );
  };

  const inviteViaWhatsApp = async (battleRoom: any) => {
    try {
      const response = await SupabaseService.callEdgeFunction('battle-operations', {
        action: 'send_invite',
        battle_room_id: battleRoom.id,
        recipient_phone: '' // Will be handled by WhatsApp
      });

      if (response && response.whatsappUrl) {
        // Share the invite message
        await Share.share({
          message: response.inviteMessage,
          title: 'Quiz Battle Challenge!'
        });
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      // Fallback to manual sharing
      const inviteMessage = `🔥 BATTLE CHALLENGE! 🔥\n\nJoin my quiz battle!\n\n📚 Topic: ${battleRoom.subject_name}\n💰 Bet: ${battleRoom.bet_amount} coins\n🎯 Room: ${battleRoom.name}\n\nRoom Code: ${battleRoom.room_code}\n\nDownload MindGains AI and join the battle!`;
      
      await Share.share({
        message: inviteMessage,
        title: 'Quiz Battle Challenge!'
      });
    }
  };

  const copyRoomCode = (roomCode: string) => {
    // For React Native, we'll show an alert with the code
    Alert.alert('Room Code', roomCode, [
      { text: 'OK' }
    ]);
  };

  const startQuickBattle = async () => {
    console.log('🔥 QUICK BATTLE BUTTON PRESSED!');
    
    try {
      // Start the matching process with full flow
      setShowMatchingModal(true);
      setMatchingStage('searching');
      console.log('🔄 Starting match search...');
      
      // Phase 1: Finding opponent
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const randomOpponent = getRandomOpponent();
      setOpponentData(randomOpponent);
      setMatchingStage('opponent-found');
      console.log('✅ Opponent found:', randomOpponent.name);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Phase 2: Generate AI Quiz
      setMatchingStage('generating-quiz');
      console.log('🤖 Generating AI quiz...');
      
      const battleRoom = await generateQuickBattleQuiz();
      console.log('✅ Quiz generated:', battleRoom?.questions?.length, 'questions');
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Phase 3: Navigate to battle quiz
      setShowMatchingModal(false);
      setMatchingStage(null);
      
      // Store questions in a way daily quiz can access them
      const quizData = {
        isQuickBattle: true,
        opponent: randomOpponent.name,
        questions: battleRoom.questions,
        provider: battleRoom.provider
      };
      
      console.log('🚀 Navigating to battle quiz with data:', quizData);
      
      // Navigate to daily quiz with battle data
      router.push({
        pathname: '/quiz/daily',
        params: { 
          isQuickBattle: 'true',
          opponent: randomOpponent.name,
          questions: JSON.stringify(battleRoom.questions),
          provider: battleRoom.provider
        }
      });
      
    } catch (error) {
      console.error('❌ Quick battle error:', error);
      setShowMatchingModal(false);
      setMatchingStage(null);
      Alert.alert('Battle Error', `Failed to start battle: ${(error as any)?.message || 'Unknown error'}`);
    }
  };

  const generateQuickBattleQuiz = async () => {
    console.log('🎯 BATTLE - generateQuickBattleQuiz called');
    
    try {
      console.log('🤖 Calling AI battle content edge function...');
      
      const response = await SupabaseService.callEdgeFunction('ai-battle-content', {
        action: 'generate_battle_questions',
        topic: 'Mixed Indian Competitive Exams',
        difficulty: 'mixed',
        questionCount: 10,
        customTopic: 'UPSC, SSC, Banking, Current Affairs, Indian History, Geography'
      });

      console.log('📡 Edge function response:', response);

      if (response && response.questions && Array.isArray(response.questions)) {
        console.log('✅ AI generated', response.questions.length, 'questions');
        return { questions: response.questions, provider: 'ai-edge-function' };
      } else {
        console.warn('⚠️ Invalid response from edge function');
        throw new Error('Invalid response format from edge function');
      }
      
    } catch (edgeError) {
      console.warn('⚠️ Edge function failed:', (edgeError as any)?.message);
      
      // Fallback to demo questions
      console.log('🎲 Using demo questions as fallback');
      return { questions: getDemoQuickBattleQuestions(), provider: 'demo' };
    }
  };

  const generateQuizWithDirectAI = async () => {
    console.log('🤖 Using direct AI API as fallback...');
    
    const topics = [
      'Indian Constitution and Fundamental Rights',
      'Indian History - Freedom Movement', 
      'Indian Geography - Physical Features',
      'Indian Economy - Five Year Plans',
      'Current Affairs 2023-2024',
      'Science and Technology - Space Missions',
      'General Knowledge - Awards and Honours'
    ];

    const prompt = `Generate 10 multiple choice questions for Indian competitive exams (UPSC/SSC/Banking) covering these topics: ${topics.join(', ')}.

Each question should have:
- 4 options (A, B, C, D)
- 1 correct answer
- Brief explanation
- Difficulty: Mixed (easy, medium, hard)
- Focus on recent current affairs and important facts

Format as JSON array with structure:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "Brief explanation",
      "topic": "Topic name",
      "difficulty": "medium"
    }
  ]
}`;

    // Try multiple AI providers as fallback
    const aiProviders = [
      { name: 'OpenAI', apiKey: 'OPENAI_API_KEY', url: 'https://api.openai.com/v1/chat/completions' },
      { name: 'Claude', apiKey: 'ANTHROPIC_API_KEY', url: 'https://api.anthropic.com/v1/messages' },
      { name: 'Grok', apiKey: 'GROK_API_KEY', url: 'https://api.x.ai/v1/chat/completions' }
    ];

    for (const provider of aiProviders) {
      try {
        console.log(`🤖 Trying ${provider.name}...`);
        const quiz = await callAIProvider(provider, prompt);
        if (quiz) {
          console.log(`✅ ${provider.name} generated quiz successfully`);
          return { questions: quiz, provider: provider.name };
        }
      } catch (providerError) {
        console.warn(`❌ ${provider.name} failed:`, (providerError as any)?.message);
        continue;
      }
    }
    
    // Ultimate fallback: Demo questions
    console.log('🎲 Using demo questions as final fallback');
    return { questions: getDemoQuickBattleQuestions(), provider: 'demo' };
  };

  const callAIProvider = async (provider: any, prompt: string) => {
    console.log(`📞 Calling ${provider.name} API...`);
    
    try {
      // Call the ai-battle-content edge function which has real AI implementations
      const response = await SupabaseService.callEdgeFunction('ai-battle-content', {
        action: 'generate_battle_questions',
        topic: 'Mixed Indian Competitive Exams',
        difficulty: 'mixed',
        questionCount: 10,
        customTopic: 'UPSC, SSC, Banking Mixed Topics'
      });

      if (response && response.questions && Array.isArray(response.questions)) {
        console.log(`✅ ${provider.name} via edge function generated ${response.questions.length} questions`);
        return response.questions;
      } else {
        throw new Error('Invalid response format from edge function');
      }
    } catch (edgeError) {
      console.warn(`⚠️ Edge function failed for ${provider.name}:`, (edgeError as any)?.message);
      
      // Fallback to demo questions if edge function fails
      console.log(`🎲 Using demo questions as fallback for ${provider.name}`);
      return getDemoQuickBattleQuestions();
    }
  };

  const getRandomOpponent = () => {
    const opponents = [
      { name: 'Rajesh Sharma', rating: 1250, city: 'Delhi' },
      { name: 'Priya Singh', rating: 1180, city: 'Mumbai' },
      { name: 'Amit Patel', rating: 1420, city: 'Ahmedabad' },
      { name: 'Sneha Reddy', rating: 1350, city: 'Hyderabad' },
      { name: 'Vikram Agarwal', rating: 1290, city: 'Kolkata' },
      { name: 'Anjali Gupta', rating: 1380, city: 'Pune' },
      { name: 'Rohit Kumar', rating: 1200, city: 'Bangalore' },
      { name: 'Kavya Nair', rating: 1450, city: 'Chennai' },
      { name: 'Arjun Mehta', rating: 1320, city: 'Jaipur' },
      { name: 'Divya Joshi', rating: 1275, city: 'Lucknow' },
      { name: 'Manish Singh', rating: 1390, city: 'Bhopal' },
      { name: 'Pooja Yadav', rating: 1230, city: 'Nagpur' },
      { name: 'Karan Shah', rating: 1410, city: 'Surat' },
      { name: 'Riya Malhotra', rating: 1340, city: 'Chandigarh' },
      { name: 'Deepak Verma', rating: 1260, city: 'Indore' }
    ];
    
    return {
      ...opponents[Math.floor(Math.random() * opponents.length)],
      isBot: true
    };
  };

  const getDemoQuickBattleQuestions = () => {
    return [
      {
        question: "Who was the first President of India?",
        options: ["Dr. A.P.J. Abdul Kalam", "Dr. Rajendra Prasad", "Dr. S. Radhakrishnan", "Zakir Husain"],
        correct_answer: 1,
        explanation: "Dr. Rajendra Prasad was the first President of India (1950-1962).",
        topic: "Indian History",
        difficulty: "easy"
      },
      {
        question: "Which Article of the Indian Constitution deals with Right to Education?",
        options: ["Article 19", "Article 21", "Article 21A", "Article 22"],
        correct_answer: 2,
        explanation: "Article 21A guarantees free and compulsory education to children aged 6-14 years.",
        topic: "Indian Polity",
        difficulty: "medium"
      },
      {
        question: "The highest peak in India is?",
        options: ["K2", "Kangchenjunga", "Nanda Devi", "Godwin Austen"],
        correct_answer: 1,
        explanation: "Kangchenjunga is the highest peak entirely in India at 8,586 meters.",
        topic: "Indian Geography",
        difficulty: "medium"
      },
      {
        question: "Which Five Year Plan was launched in 2017?",
        options: ["12th Five Year Plan", "13th Five Year Plan", "NITI Aayog Strategy", "15 Year Vision"],
        correct_answer: 2,
        explanation: "India replaced Five Year Plans with NITI Aayog's 15-year vision and 3-year action plans in 2017.",
        topic: "Indian Economy",
        difficulty: "hard"
      },
      {
        question: "Who is the current Chief Justice of India (2024)?",
        options: ["Justice D.Y. Chandrachud", "Justice U.U. Lalit", "Justice N.V. Ramana", "Justice S.A. Bobde"],
        correct_answer: 0,
        explanation: "Justice D.Y. Chandrachud is the current Chief Justice of India.",
        topic: "Current Affairs",
        difficulty: "medium"
      },
      {
        question: "India's first Mars mission was called?",
        options: ["Chandrayaan-1", "Mangalyaan", "Gaganyaan", "Astrosat"],
        correct_answer: 1,
        explanation: "Mangalyaan (Mars Orbiter Mission) was India's first successful Mars mission launched in 2013.",
        topic: "Science & Technology",
        difficulty: "easy"
      },
      {
        question: "The Bharat Ratna was first awarded in which year?",
        options: ["1947", "1954", "1950", "1952"],
        correct_answer: 1,
        explanation: "Bharat Ratna, India's highest civilian award, was first awarded in 1954.",
        topic: "General Knowledge",
        difficulty: "medium"
      },
      {
        question: "Which Indian state has the longest coastline?",
        options: ["Tamil Nadu", "Maharashtra", "Gujarat", "Andhra Pradesh"],
        correct_answer: 2,
        explanation: "Gujarat has the longest coastline in India, stretching over 1,600 km.",
        topic: "Indian Geography",
        difficulty: "easy"
      },
      {
        question: "The concept of 'Judicial Review' in Indian Constitution is borrowed from?",
        options: ["UK", "USA", "Canada", "Australia"],
        correct_answer: 1,
        explanation: "The concept of Judicial Review is borrowed from the US Constitution.",
        topic: "Indian Polity",
        difficulty: "hard"
      },
      {
        question: "Which bank was established as India's first private sector bank after independence?",
        options: ["HDFC Bank", "ICICI Bank", "Yes Bank", "Federal Bank"],
        correct_answer: 0,
        explanation: "HDFC Bank was established in 1994 as one of the first private sector banks in post-liberalization India.",
        topic: "Banking",
        difficulty: "medium"
      }
    ];
  };

  const initiateQuickBattleMatching = async () => {
    console.log('🔄 Starting matching process...');
    try {
      // Get current user data
      console.log('👤 Getting current user...');
      const user = await SupabaseService.getCurrentUser();
      if (!user) {
        console.log('❌ No user found, redirecting to auth');
        router.replace('/auth');
        return;
      }
      console.log('✅ User found:', user.id);

      console.log('📄 Getting user profile...');
      const userProfile = await SupabaseService.getUserProfile(user.id);
      console.log('✅ User profile:', userProfile?.full_name);
      
      setCurrentUser({
        id: user.id,
        name: userProfile?.full_name || 'You',
        avatar: userProfile?.avatar_url || null,
        coins: userCoins.balance
      });

      // Start matching flow
      console.log('🎬 Starting matching animation...');
      setShowMatchingModal(true);
      setMatchingStage('searching');
      console.log('✅ Modal should be showing now');

      // Phase 1: Search for opponents (2-3 seconds)
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Phase 2: Coin deduction animation
      setMatchingStage('coin-deduction');
      
      // Deduct coins with animation
      animateCoins(); // Existing coin animation
      await SupabaseService.deductUserCoins(user.id, 100);
      await loadUserCoins(); // Refresh balance
      
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Phase 3: Find opponent (real player or bot)
      setMatchingStage('opponent-found');
      
      const opponent = await findOpponent();
      setOpponentData(opponent);
      
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Phase 4: VS Screen
      setMatchingStage('vs-screen');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Phase 5: Create battle room and start quiz
      const room = await createQuickBattleRoom(user.id, opponent);
      setBattleRoom(room);
      
      setShowMatchingModal(false);
      setMatchingStage(null);

      // Navigate to live battle
      router.push({
        pathname: '/battle/live-quiz',
        params: { 
          roomId: room.id,
          isQuickBattle: 'true',
          opponentName: opponent.name
        }
      });

    } catch (error) {
      console.error('Quick battle error:', error);
      setShowMatchingModal(false);
      setMatchingStage(null);
      Alert.alert('Battle Error', 'Failed to start quick battle. Please try again.');
    }
  };

  const findOpponent = async () => {
    // Try to find real players first
    const realOpponents = await SupabaseService.makeBattleRequest('find_real_opponents', {
      difficulty: selectedDifficulty,
      bet_amount: 100
    });

    if (realOpponents.length > 0) {
      // Found real player
      const opponent = realOpponents[0];
      return {
        id: opponent.id,
        name: opponent.full_name,
        avatar: opponent.avatar_url,
        isBot: false,
        rating: opponent.rating || 1200
      };
    } else {
      // No real players, create bot opponent
      const bot = await SupabaseService.makeBattleRequest('get_bot_opponent', {
        user_rating: 1200, // Default rating
        difficulty: selectedDifficulty
      });
      
      return {
        id: bot.id,
        name: bot.name,
        avatar: null,
        isBot: true,
        rating: bot.rating
      };
    }
  };

  const createQuickBattleRoom = async (userId: string, opponent: any) => {
    // Create battle room with AI-generated questions
    const response = await SupabaseService.makeBattleRequest('create_quick_battle', {
      user_id: userId,
      opponent_id: opponent.id,
      opponent_is_bot: opponent.isBot,
      bet_amount: 100,
      difficulty: selectedDifficulty,
      topics: ['Indian History', 'Polity', 'Geography', 'Economy', 'Current Affairs', 'Science & Technology'],
      question_count: 10
    });

    if (response.error) {
      throw new Error(response.error);
    }

    return response.battleRoom;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return theme.colors.accent.green;
      case 'medium': return theme.colors.accent.yellow;
      case 'hard': return theme.colors.gradient.error[0];
      default: return theme.colors.accent.blue;
    }
  };

  const renderBattleRoom = ({ item }: { item: BattleRoom }) => (
    <TouchableOpacity 
      style={styles.roomCard} 
      onPress={() => joinBattleRoom(item.room_code)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[theme.colors.background.card, theme.colors.background.tertiary]}
        style={styles.roomGradient}
      >
        <View style={styles.roomHeader}>
          <View style={styles.roomInfo}>
            <Text style={styles.roomName}>{item.name}</Text>
            <Text style={styles.roomHost}>Host: {item.profiles?.full_name || 'Anonymous'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: theme.colors.accent.green }]}>
            <Text style={styles.statusText}>OPEN</Text>
          </View>
        </View>
        
        <View style={styles.roomDetails}>
          <View style={styles.detailItem}>
            <FontAwesome5 name="users" size={14} color={theme.colors.text.secondary} />
            <Text style={styles.detailText}>
              {item.current_participants}/{item.max_participants}
            </Text>
          </View>
          
          <View style={styles.detailItem}>
            <FontAwesome5 name="book" size={14} color={theme.colors.text.secondary} />
            <Text style={styles.detailText}>{item.subject_name}</Text>
          </View>
          
          <View style={styles.detailItem}>
            <FontAwesome5 
              name="signal" 
              size={14} 
              color={getDifficultyColor(item.difficulty)} 
            />
            <Text style={[styles.detailText, { color: getDifficultyColor(item.difficulty) }]}>
              {item.difficulty.toUpperCase()}
            </Text>
          </View>
        </View>
        
        <View style={styles.roomFooter}>
          <View style={styles.prizeInfo}>
            <FontAwesome5 name="coins" size={16} color={theme.colors.accent.gold} />
            <Text style={styles.prizeText}>{item.bet_amount} Coins</Text>
          </View>
          
          <Text style={styles.roomCode}>Code: {item.room_code}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderTopic = ({ item }: { item: Topic }) => (
    <TouchableOpacity
      style={[styles.topicCard, selectedTopic?.id === item.id && styles.selectedTopicCard]}
      onPress={() => {
        setSelectedTopic(item);
        setCustomTopic(''); // Clear custom topic when selecting predefined topic
      }}
    >
      <View style={styles.topicHeader}>
        <Text style={styles.topicSubject}>{item.subject_name}</Text>
        {item.popularity && (
          <View style={styles.popularityBadge}>
            <FontAwesome5 name="fire" size={10} color={theme.colors.accent.gold} />
            <Text style={styles.popularityText}>{item.popularity}%</Text>
          </View>
        )}
      </View>
      <Text style={styles.topicName}>{item.name}</Text>
      {item.examRelevance && (
        <Text style={styles.examRelevance}>{item.examRelevance}</Text>
      )}
    </TouchableOpacity>
  );

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowCreateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={[theme.colors.background.card, theme.colors.background.tertiary]}
            style={styles.modalGradient}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Battle Room</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowCreateModal(false)}
              >
                <FontAwesome5 name="times" size={20} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Room Name */}
              <View style={styles.inputSection}>
                <Text style={styles.sectionLabel}>Room Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={roomName}
                  onChangeText={setRoomName}
                  placeholder="Enter room name..."
                  placeholderTextColor={theme.colors.text.tertiary}
                />
              </View>

              {/* Topic Selection */}
              <View style={styles.inputSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>Topic</Text>
                  {!userSubscription.isPro && (
                    <TouchableOpacity 
                      style={styles.proButton}
                      onPress={() => setShowSubscriptionModal(true)}
                    >
                      <FontAwesome5 name="crown" size={12} color={theme.colors.accent.gold} />
                      <Text style={styles.proButtonText}>Custom Topics</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Custom Topic Input (Pro Feature) */}
                {userSubscription.isPro && (
                  <View style={styles.customTopicContainer}>
                    <TextInput
                      style={styles.customTopicInput}
                      value={customTopic}
                      onChangeText={setCustomTopic}
                      placeholder="Enter custom topic (e.g., Machine Learning, Climate Change)..."
                      placeholderTextColor={theme.colors.text.tertiary}
                      onBlur={() => {
                        if (customTopic.trim()) {
                          setSelectedTopic(null); // Clear selected topic when custom topic is used
                        }
                      }}
                    />
                    <Text style={styles.customTopicHint}>
                      💡 Custom topics use AI to generate questions
                    </Text>
                  </View>
                )}

                {/* Popular Topics Selector */}
                {(!customTopic.trim() || !userSubscription.isPro) && (
                  <TouchableOpacity
                    style={styles.topicSelector}
                    onPress={() => setShowTopicModal(true)}
                  >
                    <Text style={selectedTopic ? styles.selectedText : styles.placeholderText}>
                      {selectedTopic ? `${selectedTopic.subject_name}: ${selectedTopic.name}` : 'Select from popular topics'}
                    </Text>
                    <FontAwesome5 name="chevron-right" size={16} color={theme.colors.text.secondary} />
                  </TouchableOpacity>
                )}

                {/* AI Usage Warning */}
                {(customTopic.trim() || (!selectedTopic && userSubscription.isPro)) && (
                  <View style={styles.aiWarning}>
                    <FontAwesome5 name="robot" size={14} color={theme.colors.accent.purple} />
                    <Text style={styles.aiWarningText}>
                      {userSubscription.isPro 
                        ? `AI Generations: ${userSubscription.aiGenerationsUsed}/${userSubscription.dailyAiLimit === 999999 ? '∞' : userSubscription.dailyAiLimit}`
                        : `AI Generations: ${userSubscription.aiGenerationsUsed}/${userSubscription.dailyAiLimit} (Upgrade for unlimited)`
                      }
                    </Text>
                  </View>
                )}
              </View>

              {/* Difficulty */}
              <View style={styles.inputSection}>
                <Text style={styles.sectionLabel}>Difficulty</Text>
                <View style={styles.difficultyContainer}>
                  {difficulties.map((diff) => (
                    <TouchableOpacity
                      key={diff.value}
                      style={[
                        styles.difficultyButton,
                        selectedDifficulty === diff.value && styles.selectedDifficultyButton,
                        { borderColor: diff.color }
                      ]}
                      onPress={() => setSelectedDifficulty(diff.value as any)}
                    >
                      <Text style={[
                        styles.difficultyText,
                        selectedDifficulty === diff.value && { color: diff.color }
                      ]}>
                        {diff.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Bet Amount */}
              <View style={styles.inputSection}>
                <Text style={styles.sectionLabel}>Bet Amount</Text>
                <View style={styles.betContainer}>
                  {betAmounts.map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={[
                        styles.betButton,
                        selectedBetAmount === amount && styles.selectedBetButton,
                        userCoins.balance < amount && styles.disabledBetButton
                      ]}
                      onPress={() => setSelectedBetAmount(amount)}
                      disabled={userCoins.balance < amount}
                    >
                      <FontAwesome5 name="coins" size={14} color={theme.colors.accent.gold} />
                      <Text style={[
                        styles.betText,
                        selectedBetAmount === amount && styles.selectedBetText,
                        userCoins.balance < amount && styles.disabledBetText
                      ]}>
                        {amount}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Create Button */}
              <TouchableOpacity
                style={[styles.createButton, loading && styles.disabledButton]}
                onPress={createBattleRoom}
                disabled={loading || (!selectedTopic && !customTopic.trim()) || !roomName.trim()}
              >
                <LinearGradient
                  colors={loading ? [theme.colors.text.tertiary, theme.colors.text.tertiary] : theme.colors.gradient.primary}
                  style={styles.createButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color={theme.colors.text.primary} />
                  ) : (
                    <>
                      <FontAwesome5 name="plus-circle" size={18} color={theme.colors.text.primary} solid />
                      <Text style={styles.createButtonText}>Create Battle</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  const renderTopicModal = () => (
    <Modal
      visible={showTopicModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowTopicModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={[theme.colors.background.card, theme.colors.background.tertiary]}
            style={styles.modalGradient}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Topic</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowTopicModal(false)}
              >
                <FontAwesome5 name="times" size={20} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={topics}
              renderItem={renderTopic}
              keyExtractor={(item) => item.id}
              style={styles.topicsList}
              showsVerticalScrollIndicator={false}
            />
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  const renderQuickBattle = () => (
    <View style={styles.quickBattleContainer}>
      <LinearGradient
        colors={theme.colors.gradient.primary}
        style={styles.quickBattleCard}
      >
        <Animated.View style={[styles.swordContainer, { transform: [{ scale: pulseAnim }] }]}>
          <FontAwesome5 name="bolt" size={60} color={theme.colors.text.primary} solid />
          <FontAwesome5 
            name="fire" 
            size={40} 
            color={theme.colors.accent.gold}
            style={[styles.crossedSword, { transform: [{ rotate: '15deg' }] }]}
            solid
          />
        </Animated.View>
        
        <Text style={styles.quickBattleTitle}>Quick Battle</Text>
        <Text style={styles.quickBattleSubtitle}>
          Instant matching • Always find an opponent • 100 coins entry
        </Text>
        
        <TouchableOpacity 
          style={[styles.quickBattleButton, loading && styles.disabledButton]}
          onPress={() => {
            console.log('🎯 TOUCH DETECTED ON QUICK BATTLE BUTTON');
            startQuickBattle();
          }}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.text.primary} />
          ) : (
            <>
              <FontAwesome5 name="bolt" size={20} color={theme.colors.text.primary} />
              <Text style={styles.quickBattleButtonText}>Find Opponent</Text>
            </>
          )}
        </TouchableOpacity>
      </LinearGradient>
      

      {/* Join Room Section */}
      <View style={styles.joinRoomSection}>
        <Text style={styles.joinRoomTitle}>Join with Room Code</Text>
        <View style={styles.joinRoomContainer}>
          <TextInput
            style={styles.roomCodeInput}
            value={joinRoomCode}
            onChangeText={setJoinRoomCode}
            placeholder="Enter room code"
            placeholderTextColor={theme.colors.text.tertiary}
            autoCapitalize="characters"
            maxLength={6}
          />
          <TouchableOpacity
            style={[styles.joinButton, !joinRoomCode.trim() && styles.disabledButton]}
            onPress={() => joinBattleRoom(joinRoomCode.trim())}
            disabled={!joinRoomCode.trim()}
          >
            <FontAwesome5 name="sign-in-alt" size={16} color={theme.colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const TabButton = ({ tab, title, icon }: { tab: string; title: string; icon: string }) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
      onPress={() => setActiveTab(tab as any)}
    >
      <FontAwesome5 
        name={icon} 
        size={18} 
        color={activeTab === tab ? theme.colors.text.primary : theme.colors.text.tertiary} 
      />
      <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderMatchingModal = () => {
    if (matchingStage === 'vs-screen') {
      return renderVSScreen();
    }

    return (
      <Modal
        visible={showMatchingModal}
        animationType="fade"
        transparent
        onRequestClose={() => {}}
      >
        <View style={styles.matchingModalOverlay}>
          <View style={styles.matchingModalContent}>
            <LinearGradient
              colors={[theme.colors.accent.purple, theme.colors.accent.blue]}
              style={styles.matchingGradient}
            >
              {renderMatchingStageContent()}
            </LinearGradient>
          </View>
        </View>
      </Modal>
    );
  };

  const renderMatchingStageContent = () => {
    switch (matchingStage) {
      case 'searching':
        return (
          <>
            <Animated.View style={[styles.matchingIconContainer, { transform: [{ scale: pulseAnim }] }]}>
              <FontAwesome5 name="search" size={48} color={theme.colors.text.primary} solid />
            </Animated.View>
            <Text style={styles.matchingTitle}>Finding Opponents...</Text>
            <Text style={styles.matchingSubtitle}>Searching for players online</Text>
            <View style={styles.loadingDots}>
              <Animated.View style={[styles.dot, { opacity: glowAnim }]} />
              <Animated.View style={[styles.dot, { opacity: glowAnim, marginLeft: 8 }]} />
              <Animated.View style={[styles.dot, { opacity: glowAnim, marginLeft: 8 }]} />
            </View>
          </>
        );

      case 'coin-deduction':
        return (
          <>
            <Animated.View style={[styles.matchingIconContainer, { transform: [{ scale: coinsAnim }] }]}>
              <FontAwesome5 name="coins" size={48} color={theme.colors.accent.gold} solid />
            </Animated.View>
            <Text style={styles.matchingTitle}>Entry Fee</Text>
            <Text style={styles.matchingSubtitle}>Deducting 100 coins...</Text>
            <View style={styles.coinDeductionAnimation}>
              <Text style={styles.coinAmount}>-100 💰</Text>
            </View>
          </>
        );

      case 'opponent-found':
        return (
          <>
            <Animated.View style={[styles.matchingIconContainer, { transform: [{ scale: pulseAnim }] }]}>
              <FontAwesome5 name="check-circle" size={48} color={theme.colors.accent.green} solid />
            </Animated.View>
            <Text style={styles.matchingTitle}>Opponent Found!</Text>
            <Text style={styles.matchingSubtitle}>
              {opponentData?.name || 'Player'} • Rating: {opponentData?.rating || 1200}
            </Text>
            {opponentData && (
              <View style={styles.opponentInfo}>
                <View style={styles.opponentAvatar}>
                  <FontAwesome5 name="user" size={24} color={theme.colors.text.primary} />
                </View>
                <Text style={styles.opponentName}>{opponentData.name}</Text>
              </View>
            )}
          </>
        );

      case 'generating-quiz':
        return (
          <>
            <Animated.View style={[styles.matchingIconContainer, { transform: [{ scale: pulseAnim }] }]}>
              <FontAwesome5 name="brain" size={48} color={theme.colors.accent.purple} solid />
            </Animated.View>
            <Text style={styles.matchingTitle}>Generating Questions...</Text>
            <Text style={styles.matchingSubtitle}>AI is creating your battle quiz</Text>
            <View style={styles.loadingDots}>
              <Animated.View style={[styles.dot, { opacity: glowAnim }]} />
              <Animated.View style={[styles.dot, { opacity: glowAnim, marginLeft: 8 }]} />
              <Animated.View style={[styles.dot, { opacity: glowAnim, marginLeft: 8 }]} />
            </View>
          </>
        );

      default:
        return (
          <>
            <Animated.View style={[styles.matchingIconContainer, { transform: [{ scale: pulseAnim }] }]}>
              <FontAwesome5 name="fist-raised" size={48} color={theme.colors.text.primary} solid />
            </Animated.View>
            <Text style={styles.matchingTitle}>Preparing Battle...</Text>
            <Text style={styles.matchingSubtitle}>Getting ready to fight!</Text>
          </>
        );
    }
  };

  const renderVSScreen = () => {
    return (
      <Modal
        visible={showMatchingModal}
        animationType="fade"
        transparent
        onRequestClose={() => {}}
      >
        <LinearGradient
          colors={[theme.colors.background.primary, theme.colors.background.secondary]}
          style={styles.vsScreenContainer}
        >
          {/* VS Screen Header */}
          <Text style={styles.vsScreenTitle}>BATTLE COMMENCING</Text>
          
          {/* Players Section */}
          <View style={styles.vsPlayersContainer}>
            {/* Current User */}
            <View style={styles.vsPlayer}>
              <View style={styles.vsPlayerAvatar}>
                <FontAwesome5 name="user" size={40} color={theme.colors.accent.blue} />
              </View>
              <Text style={styles.vsPlayerName}>{currentUser?.name || 'You'}</Text>
              <Text style={styles.vsPlayerRating}>Rating: 1200</Text>
            </View>

            {/* VS Text */}
            <Animated.View style={[styles.vsTextContainer, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={styles.vsText}>VS</Text>
            </Animated.View>

            {/* Opponent */}
            <View style={styles.vsPlayer}>
              <View style={styles.vsPlayerAvatar}>
                <FontAwesome5 name="user" size={40} color={theme.colors.accent.red} />
              </View>
              <Text style={styles.vsPlayerName}>{opponentData?.name || 'Opponent'}</Text>
              <Text style={styles.vsPlayerRating}>Rating: {opponentData?.rating || 1200}</Text>
            </View>
          </View>

          {/* Battle Info */}
          <View style={styles.battleInfo}>
            <Text style={styles.battleInfoTitle}>QUICK BATTLE</Text>
            <Text style={styles.battleInfoSubtitle}>10 Questions • Mixed Topics • 100 Coins</Text>
          </View>

          {/* Loading */}
          <Text style={styles.vsLoadingText}>Starting battle...</Text>
        </LinearGradient>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[theme.colors.background.primary, theme.colors.background.secondary]}
        style={styles.background}
      >
        {/* Header with Coins */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.titleContainer}>
              <LinearGradient
                colors={theme.colors.gradient.primary}
                style={styles.titleGradient}
              >
                <FontAwesome5 name="fist-raised" size={24} color={theme.colors.text.primary} solid />
                <Text style={styles.headerTitle}>Battle Arena</Text>
              </LinearGradient>
            </View>
            
            <Animated.View style={[styles.coinsContainer, { transform: [{ scale: coinsAnim }] }]}>
              <FontAwesome5 name="coins" size={20} color={theme.colors.accent.gold} />
              <Text style={styles.coinsText}>{(userCoins?.balance || 0).toLocaleString()}</Text>
            </Animated.View>
          </View>
          
          <Text style={styles.headerSubtitle}>
            Challenge players • Win rewards • Climb rankings
          </Text>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TabButton tab="quick" title="Quick Battle" icon="bolt" />
            <TabButton tab="rooms" title="Battle Rooms" icon="users" />
            <TabButton tab="create" title="Create Room" icon="plus" />
          </ScrollView>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'quick' && renderQuickBattle()}
          
          {activeTab === 'rooms' && (
            <View style={styles.roomsContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Active Battle Rooms</Text>
                <TouchableOpacity onPress={loadBattleRooms}>
                  <FontAwesome5 name="sync" size={16} color={theme.colors.accent.purple} />
                </TouchableOpacity>
              </View>
              
              {battleRooms.length > 0 ? (
                <FlatList
                  data={battleRooms}
                  renderItem={renderBattleRoom}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  showsVerticalScrollIndicator={false}
                />
              ) : (
                <View style={styles.emptyState}>
                  <FontAwesome5 name="inbox" size={48} color={theme.colors.text.tertiary} />
                  <Text style={styles.emptyText}>No active battles</Text>
                  <Text style={styles.emptySubtext}>Create a room to start battling!</Text>
                </View>
              )}
            </View>
          )}
          
          {activeTab === 'create' && (
            <View style={styles.createContainer}>
              <LinearGradient
                colors={[theme.colors.background.card, theme.colors.background.tertiary]}
                style={styles.createCard}
              >
                <View style={styles.createHeader}>
                  <FontAwesome5 name="plus-circle" size={32} color={theme.colors.accent.purple} />
                  <Text style={styles.createTitle}>Create Battle Room</Text>
                  <Text style={styles.createSubtitle}>Set up your own quiz battle arena</Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.createMainButton}
                  onPress={() => setShowCreateModal(true)}
                >
                  <LinearGradient
                    colors={theme.colors.gradient.primary}
                    style={styles.createButtonGradient}
                  >
                    <FontAwesome5 name="hammer" size={20} color={theme.colors.text.primary} />
                    <Text style={styles.createButtonText}>Create Room</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}
        </ScrollView>

        {renderCreateModal()}
        {renderTopicModal()}
        {showSubscriptionModal && renderSubscriptionModal()}
        {showModerationWarning && renderModerationWarningModal()}
        {showMatchingModal && renderMatchingModal()}
      </LinearGradient>
    </SafeAreaView>
  );
}

function renderSubscriptionModal() {
  return (
    <Modal
      visible={showSubscriptionModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowSubscriptionModal(false)}
    >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <LinearGradient
          colors={[theme.colors.background.card, theme.colors.background.tertiary]}
          style={styles.modalGradient}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upgrade to Pro</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowSubscriptionModal(false)}
            >
              <FontAwesome5 name="times" size={20} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            <View style={styles.subscriptionContent}>
              <LinearGradient
                colors={theme.colors.gradient.primary}
                style={styles.proHeader}
              >
                <FontAwesome5 name="crown" size={32} color={theme.colors.text.primary} />
                <Text style={styles.proTitle}>MindGains Pro</Text>
                <Text style={styles.proSubtitle}>Unlock unlimited battle potential</Text>
              </LinearGradient>

              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <FontAwesome5 name="infinity" size={16} color={theme.colors.accent.green} />
                  <Text style={styles.featureText}>Unlimited daily battles</Text>
                </View>
                <View style={styles.featureItem}>
                  <FontAwesome5 name="robot" size={16} color={theme.colors.accent.purple} />
                  <Text style={styles.featureText}>Unlimited AI question generation</Text>
                </View>
                <View style={styles.featureItem}>
                  <FontAwesome5 name="edit" size={16} color={theme.colors.accent.blue} />
                  <Text style={styles.featureText}>Custom topics with AI moderation</Text>
                </View>
                <View style={styles.featureItem}>
                  <FontAwesome5 name="medal" size={16} color={theme.colors.accent.gold} />
                  <Text style={styles.featureText}>Premium battle rooms</Text>
                </View>
                <View style={styles.featureItem}>
                  <FontAwesome5 name="chart-line" size={16} color={theme.colors.accent.cyan} />
                  <Text style={styles.featureText}>Advanced battle analytics</Text>
                </View>
                <View style={styles.featureItem}>
                  <FontAwesome5 name="star" size={16} color={theme.colors.accent.yellow} />
                  <Text style={styles.featureText}>Priority matching & support</Text>
                </View>
              </View>

              <View style={styles.pricingContainer}>
                <TouchableOpacity style={styles.pricingCard}>
                  <LinearGradient
                    colors={[theme.colors.accent.purple, theme.colors.accent.blue]}
                    style={styles.pricingGradient}
                  >
                    <Text style={styles.pricingTitle}>Monthly</Text>
                    <Text style={styles.pricingPrice}>₹99</Text>
                    <Text style={styles.pricingSubtitle}>per month</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.pricingCard, styles.recommendedCard]}>
                  <LinearGradient
                    colors={[theme.colors.accent.gold, theme.colors.accent.yellow]}
                    style={styles.pricingGradient}
                  >
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedText}>BEST VALUE</Text>
                    </View>
                    <Text style={styles.pricingTitle}>Yearly</Text>
                    <Text style={styles.pricingPrice}>₹999</Text>
                    <Text style={styles.pricingSubtitle}>Save ₹189</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.upgradeButton}>
                <LinearGradient
                  colors={theme.colors.gradient.primary}
                  style={styles.upgradeButtonGradient}
                >
                  <FontAwesome5 name="rocket" size={18} color={theme.colors.text.primary} />
                  <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.subscriptionNote}>
                🎓 Special student pricing available • Cancel anytime
              </Text>
            </View>
          </ScrollView>
        </LinearGradient>
      </View>
    </View>
  </Modal>
  );
}

function renderModerationWarningModal() {
  return (
    <Modal
      visible={showModerationWarning}
      animationType="fade"
      transparent
      onRequestClose={() => setShowModerationWarning(false)}
    >
    <View style={styles.modalOverlay}>
      <View style={styles.warningModalContent}>
        <LinearGradient
          colors={[theme.colors.gradient.error[0], theme.colors.gradient.error[1]]}
          style={styles.warningHeader}
        >
          <FontAwesome5 name="exclamation-triangle" size={32} color={theme.colors.text.primary} />
          <Text style={styles.warningTitle}>{moderationResult?.warning}</Text>
        </LinearGradient>

        <View style={styles.warningBody}>
          <Text style={styles.warningMessage}>{moderationResult?.message}</Text>

          {moderationResult?.suggestedTopics && (
            <View style={styles.suggestedTopics}>
              <Text style={styles.suggestedTitle}>Suggested Topics:</Text>
              {moderationResult.suggestedTopics.map((topic: string, index: number) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestedTopic}
                  onPress={() => {
                    setCustomTopic(topic);
                    setShowModerationWarning(false);
                  }}
                >
                  <FontAwesome5 name="lightbulb" size={14} color={theme.colors.accent.yellow} />
                  <Text style={styles.suggestedTopicText}>{topic}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.warningActions}>
            <TouchableOpacity
              style={styles.warningButton}
              onPress={() => setShowModerationWarning(false)}
            >
              <Text style={styles.warningButtonText}>Try Different Topic</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  </Modal>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
  },
  titleGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginLeft: 12,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  coinsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    ...theme.shadows.card,
  },
  coinsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.accent.gold,
    marginLeft: 8,
  },
  tabContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 24,
    backgroundColor: theme.colors.background.card,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  activeTabButton: {
    backgroundColor: theme.colors.accent.purple,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.tertiary,
    marginLeft: 8,
  },
  activeTabText: {
    color: theme.colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 0,
  },
  quickBattleContainer: {
    marginBottom: 20,
  },
  quickBattleCard: {
    margin: 16,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    ...theme.shadows.glow,
    marginBottom: 24,
  },
  swordContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  crossedSword: {
    position: 'absolute',
  },
  quickBattleTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  quickBattleSubtitle: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  quickBattleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    minWidth: 200,
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  quickBattleButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginLeft: 8,
  },
  joinRoomSection: {
    backgroundColor: theme.colors.background.card,
    padding: 20,
    borderRadius: 16,
    ...theme.shadows.card,
  },
  joinRoomTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 12,
  },
  joinRoomContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomCodeInput: {
    flex: 1,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text.primary,
    marginRight: 12,
    textAlign: 'center',
  },
  joinButton: {
    backgroundColor: theme.colors.accent.purple,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  roomsContainer: {
    marginBottom: 20,
  },
  roomCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  roomGradient: {
    padding: 20,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  roomHost: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  roomDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginLeft: 6,
  },
  roomFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prizeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prizeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.accent.gold,
    marginLeft: 8,
  },
  roomCode: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
    fontFamily: 'monospace',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.secondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
    marginTop: 4,
  },
  createContainer: {
    marginBottom: 20,
  },
  createCard: {
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  createHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  createTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  createSubtitle: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  createMainButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalGradient: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.tertiary,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    flex: 1,
    padding: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  topicSelector: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedText: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  placeholderText: {
    fontSize: 16,
    color: theme.colors.text.tertiary,
  },
  difficultyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  difficultyButton: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    backgroundColor: theme.colors.background.tertiary,
  },
  selectedDifficultyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  difficultyText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text.secondary,
  },
  betContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  betButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
    width: '30%',
    justifyContent: 'center',
  },
  selectedBetButton: {
    backgroundColor: theme.colors.accent.purple,
  },
  disabledBetButton: {
    backgroundColor: theme.colors.background.tertiary,
    opacity: 0.5,
  },
  betText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  selectedBetText: {
    color: theme.colors.text.primary,
  },
  disabledBetText: {
    color: theme.colors.text.tertiary,
  },
  createButton: {
    borderRadius: 25,
    overflow: 'hidden',
    marginTop: 20,
  },
  topicsList: {
    flex: 1,
    padding: 20,
  },
  topicCard: {
    backgroundColor: theme.colors.background.tertiary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedTopicCard: {
    borderColor: theme.colors.accent.purple,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  topicSubject: {
    fontSize: 12,
    color: theme.colors.accent.purple,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  topicName: {
    fontSize: 16,
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  popularityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  popularityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.colors.accent.gold,
    marginLeft: 4,
  },
  examRelevance: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  proButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  proButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.accent.gold,
    marginLeft: 4,
  },
  customTopicContainer: {
    marginBottom: 16,
  },
  customTopicInput: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text.primary,
    borderWidth: 2,
    borderColor: theme.colors.accent.purple,
  },
  customTopicHint: {
    fontSize: 12,
    color: theme.colors.accent.purple,
    marginTop: 8,
    textAlign: 'center',
  },
  aiWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  aiWarningText: {
    fontSize: 12,
    color: theme.colors.accent.purple,
    marginLeft: 8,
    flex: 1,
  },
  subscriptionContent: {
    padding: 20,
  },
  proHeader: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
  },
  proTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginTop: 12,
  },
  proSubtitle: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  featuresList: {
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: 8,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    marginLeft: 12,
    flex: 1,
  },
  pricingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  pricingCard: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  recommendedCard: {
    transform: [{ scale: 1.05 }],
  },
  pricingGradient: {
    padding: 20,
    alignItems: 'center',
    position: 'relative',
  },
  recommendedBadge: {
    position: 'absolute',
    top: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  pricingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginTop: 8,
  },
  pricingPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginTop: 4,
  },
  pricingSubtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  upgradeButton: {
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 16,
  },
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  upgradeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginLeft: 8,
  },
  subscriptionNote: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  warningModalContent: {
    backgroundColor: theme.colors.background.card,
    borderRadius: 16,
    margin: 20,
    overflow: 'hidden',
    maxHeight: '70%',
  },
  warningHeader: {
    alignItems: 'center',
    padding: 24,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginTop: 12,
    textAlign: 'center',
  },
  warningBody: {
    padding: 20,
  },
  warningMessage: {
    fontSize: 16,
    color: theme.colors.text.primary,
    lineHeight: 24,
    marginBottom: 20,
  },
  suggestedTopics: {
    marginBottom: 20,
  },
  suggestedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 12,
  },
  suggestedTopic: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.tertiary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  suggestedTopicText: {
    fontSize: 14,
    color: theme.colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },
  warningActions: {
    alignItems: 'center',
  },
  warningButton: {
    backgroundColor: theme.colors.accent.purple,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  warningButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  
  // Matching Modal Styles
  matchingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  matchingModalContent: {
    backgroundColor: 'transparent',
    borderRadius: 28,
    marginHorizontal: 16,
    marginVertical: 'auto',
    overflow: 'hidden',
    ...theme.shadows.card,
    alignSelf: 'center',
    width: Math.min(width - 32, 400),
    maxWidth: 400,
  },
  matchingGradient: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 350,
    borderRadius: 24,
  },
  matchingIconContainer: {
    position: 'relative',
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleIcon: {
    position: 'absolute',
    top: -10,
    right: -10,
  },
  matchingTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  matchingSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '500',
  },
  matchingFeatures: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  matchingFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  matchingFeatureText: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.text.primary,
  },

  // Coin Deduction Animation
  coinDeductionAnimation: {
    alignItems: 'center',
    marginTop: 20,
  },
  coinAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.accent.gold,
  },

  // Opponent Info
  opponentInfo: {
    alignItems: 'center',
    marginTop: 20,
  },
  opponentAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.accent.purple,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  opponentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },

  // VS Screen Styles
  vsScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  vsScreenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.accent.gold,
    textAlign: 'center',
    marginBottom: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  vsPlayersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 40,
  },
  vsPlayer: {
    alignItems: 'center',
    flex: 1,
  },
  vsPlayerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: theme.colors.accent.purple,
  },
  vsPlayerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  vsPlayerRating: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  vsTextContainer: {
    marginHorizontal: 20,
  },
  vsText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: theme.colors.accent.red,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  battleInfo: {
    alignItems: 'center',
    marginBottom: 40,
    backgroundColor: theme.colors.background.card,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  battleInfoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.accent.purple,
    marginBottom: 8,
  },
  battleInfoSubtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  vsLoadingText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
});