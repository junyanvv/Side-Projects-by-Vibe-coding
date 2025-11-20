
import React, { useState, useRef, useEffect } from 'react';
import { 
  getWordDetails, 
  generateWordImage, 
  chatAboutWord, 
  playPronunciation,
  getAdditionalMeanings,
  generateStoryFromWords
} from './services/gemini';
import { 
  SearchIcon, 
  VolumeIcon, 
  MessageCircleIcon, 
  XIcon, 
  SendIcon, 
  ImageIcon,
  SparklesIcon,
  BookIcon,
  LightbulbIcon,
  RefreshIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  ZapIcon,
  GridIcon,
  BookmarkIcon,
  TrashIcon,
  PenToolIcon
} from './components/Icons';
import { Loader } from './components/Loader';
import { WordDefinition, ChatMessage, SupportedLanguage, AdditionalMeaning, SavedItem, StoryQuiz } from './types';

type View = 'search' | 'wordbook';

// Helper Component for Interactive Quiz Blanks
const QuizBlank = ({ word }: { word: string }) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <span 
      onClick={() => setRevealed(true)}
      className={`inline-flex items-center justify-center min-w-[80px] px-2 py-0 mx-1 rounded cursor-pointer transition-all duration-300 border-b-2 ${
        revealed 
          ? 'bg-orange-100 border-orange-500 text-orange-900 font-bold' 
          : 'bg-stone-200 border-stone-400 text-transparent hover:bg-stone-300'
      }`}
    >
      {revealed ? word : <span className="select-none opacity-0">{word}</span>}
    </span>
  );
};

function App() {
  // State
  const [view, setView] = useState<View>('search');
  const [query, setQuery] = useState('');
  
  // Language State
  const [targetLanguage, setTargetLanguage] = useState<SupportedLanguage>(SupportedLanguage.SPANISH); // Explain in
  const [nativeLanguage, setNativeLanguage] = useState<SupportedLanguage>(SupportedLanguage.ENGLISH); // Native Language
  
  // Data State
  const [wordData, setWordData] = useState<WordDefinition | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [additionalMeanings, setAdditionalMeanings] = useState<AdditionalMeaning[] | null>(null);
  const [imageFeedbacks, setImageFeedbacks] = useState<Record<string, 'like' | 'dislike'>>({});
  
  // Saved Items
  const [savedItems, setSavedItems] = useState<SavedItem[]>(() => {
    try {
      const local = localStorage.getItem('leximind_saved');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  });

  // Story Mode State
  const [storyQuiz, setStoryQuiz] = useState<StoryQuiz | null>(null);
  const [loadingStory, setLoadingStory] = useState(false);
  
  // Loading States
  const [loadingWord, setLoadingWord] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [loadingMoreMeanings, setLoadingMoreMeanings] = useState(false);
  const [loadingNewImage, setLoadingNewImage] = useState(false);
  
  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('leximind_saved', JSON.stringify(savedItems));
  }, [savedItems]);

  // Handlers
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setView('search');

    // Reset all states
    setLoadingWord(true);
    setLoadingImage(true);
    setWordData(null);
    setGallery([]);
    setActiveImageIndex(0);
    setAdditionalMeanings(null);
    setImageFeedbacks({});
    setChatMessages([]);
    setIsChatOpen(false);

    try {
      // Parallel fetch
      const detailsPromise = getWordDetails(query, targetLanguage, nativeLanguage);
      const imagePromise = generateWordImage(query);

      const details = await detailsPromise;
      setWordData(details);
      setLoadingWord(false);

      const img = await imagePromise;
      if (img) {
        setGallery([img]);
      }
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setLoadingWord(false);
      setLoadingImage(false);
    }
  };

  const handleAudioPlay = async () => {
    if (!wordData) return;
    try {
      setLoadingAudio(true);
      await playPronunciation(wordData.word);
    } catch (err) {
      console.error("Audio playback failed", err);
    } finally {
      setLoadingAudio(false);
    }
  };

  const handleLoadMoreMeanings = async () => {
    if (!wordData) return;
    setLoadingMoreMeanings(true);
    try {
      const meanings = await getAdditionalMeanings(wordData.word, targetLanguage);
      setAdditionalMeanings(meanings);
    } catch (err) {
      console.error("Failed to load meanings", err);
    } finally {
      setLoadingMoreMeanings(false);
    }
  };

  const handleGenerateNewImage = async () => {
    if (!wordData) return;
    setLoadingNewImage(true);
    try {
      // Create a slight variation in prompt context based on existing gallery size
      const context = gallery.length === 1 ? "Abstract and colorful interpretation" : "Real world scenario usage";
      const newImg = await generateWordImage(wordData.word, context);
      if (newImg) {
        setGallery(prev => [...prev, newImg]);
        setActiveImageIndex(prev => prev + 1);
      }
    } catch (err) {
      console.error("Failed to generate new image", err);
    } finally {
      setLoadingNewImage(false);
    }
  };

  const toggleFeedback = (type: 'like' | 'dislike') => {
    const currentUrl = gallery[activeImageIndex];
    if (!currentUrl) return;

    setImageFeedbacks(prev => {
      const current = prev[currentUrl];
      if (current === type) {
        const newState = { ...prev };
        delete newState[currentUrl];
        return newState;
      }
      return { ...prev, [currentUrl]: type };
    });
  };

  const handleSaveItem = () => {
    if (!wordData || !currentImage) return;
    
    const newItem: SavedItem = {
      id: Date.now().toString(),
      word: wordData.word,
      definition: wordData.definition,
      imageUrl: currentImage,
      timestamp: Date.now()
    };

    setSavedItems(prev => {
      // Prevent duplicates of same word/image combo
      if (prev.some(item => item.word === newItem.word && item.imageUrl === newItem.imageUrl)) {
        return prev;
      }
      return [newItem, ...prev];
    });
  };

  const handleRemoveSavedItem = (id: string) => {
    setSavedItems(prev => prev.filter(item => item.id !== id));
  };

  const handleGenerateStory = async () => {
    if (savedItems.length === 0) return;
    setLoadingStory(true);
    setStoryQuiz(null);
    
    try {
      // Extract unique words
      const uniqueWords = Array.from(new Set(savedItems.map(i => i.word)));
      const quiz = await generateStoryFromWords(uniqueWords, targetLanguage);
      setStoryQuiz(quiz);
    } catch (err) {
      console.error("Story generation failed", err);
    } finally {
      setLoadingStory(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !wordData) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: chatInput
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatSending(true);

    try {
      const history = chatMessages.map(m => ({ role: m.role, text: m.text }));
      const responseText = await chatAboutWord(history, userMsg.text, wordData.word, targetLanguage, nativeLanguage);
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText || "I couldn't answer that at the moment."
      };
      setChatMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error("Chat failed", err);
    } finally {
      setIsChatSending(false);
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatOpen]);

  // Render Helper for Story Content
  const renderStoryContent = (content: string) => {
    // Split by {{word}}
    const parts = content.split(/(\{\{.*?\}\})/g);
    
    return (
      <p className="text-xl leading-loose text-stone-800 font-serif">
        {parts.map((part, i) => {
          if (part.startsWith('{{') && part.endsWith('}}')) {
            const word = part.slice(2, -2);
            return <QuizBlank key={i} word={word} />;
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
    );
  };

  const currentImage = gallery[activeImageIndex];
  const currentFeedback = currentImage ? imageFeedbacks[currentImage] : undefined;
  const isCurrentSaved = savedItems.some(item => item.imageUrl === currentImage && item.word === wordData?.word);

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F8F6] text-stone-900 font-sans selection:bg-orange-100 selection:text-orange-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <button onClick={() => setView('search')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-stone-900 text-white rounded-xl flex items-center justify-center">
               <BookIcon className="w-6 h-6" />
            </div>
            <span className="font-serif font-bold text-2xl tracking-tight text-stone-900">LexiMind</span>
          </button>
          
          <div className="flex items-center gap-4 md:gap-6">
            <div className="flex flex-col md:flex-row items-end md:items-center gap-2 md:gap-6">
              
              {/* I speak... */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">I speak</span>
                <select 
                  value={nativeLanguage}
                  onChange={(e) => setNativeLanguage(e.target.value as SupportedLanguage)}
                  className="text-sm bg-transparent border-b border-stone-200 hover:border-orange-400 text-stone-900 font-semibold focus:ring-0 cursor-pointer py-1 pr-1 w-24 md:w-auto transition-colors"
                >
                  {Object.values(SupportedLanguage).map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              {/* Explain in... */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Explain in</span>
                <select 
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value as SupportedLanguage)}
                  className="text-sm bg-transparent border-b border-stone-200 hover:border-orange-400 text-orange-700 font-semibold focus:ring-0 cursor-pointer py-1 pr-1 w-24 md:w-auto transition-colors"
                >
                  {Object.values(SupportedLanguage).map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>
            </div>

            <button 
              onClick={() => setView(view === 'wordbook' ? 'search' : 'wordbook')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                view === 'wordbook' 
                ? 'bg-orange-100 border-orange-200 text-orange-800' 
                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              <GridIcon className="w-4 h-4" />
              <span className="font-bold text-sm hidden sm:inline">Wordbook</span>
              {savedItems.length > 0 && (
                <span className="ml-1 bg-stone-900 text-white text-[10px] font-bold px-1.5 rounded-full">
                  {savedItems.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow px-4 py-12">
        <div className="max-w-5xl mx-auto w-full">
          
          {view === 'wordbook' ? (
            /* WORDBOOK VIEW */
            <div className="animate-fade-in space-y-8">
               <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-stone-200 pb-6 gap-4">
                 <div>
                   <h2 className="text-4xl font-serif font-bold text-stone-900">My Wordbook</h2>
                   <p className="text-stone-500 font-medium mt-1">{savedItems.length} Saved Words</p>
                 </div>
                 
                 {savedItems.length > 0 && (
                   <button 
                     onClick={handleGenerateStory}
                     disabled={loadingStory}
                     className="flex items-center gap-2 px-5 py-3 bg-stone-900 text-white rounded-xl hover:bg-orange-600 transition-all shadow-lg disabled:opacity-70"
                   >
                     {loadingStory ? <Loader size="sm" color="text-white" /> : <PenToolIcon className="w-4 h-4" />}
                     <span className="font-bold text-sm">Practice with AI Story</span>
                   </button>
                 )}
               </div>

               {/* Story Mode Section */}
               {storyQuiz && (
                 <div className="bg-white border border-orange-200 rounded-3xl p-8 shadow-xl shadow-orange-100/50 relative overflow-hidden animate-fade-in mb-10">
                   <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-red-500" />
                   <div className="flex justify-between items-start mb-6">
                     <h3 className="text-3xl font-serif font-bold text-stone-900">{storyQuiz.title}</h3>
                     <button 
                       onClick={() => setStoryQuiz(null)}
                       className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-600"
                     >
                       <XIcon className="w-6 h-6" />
                     </button>
                   </div>
                   
                   <div className="prose prose-stone max-w-none">
                      {renderStoryContent(storyQuiz.content)}
                   </div>
                   
                   <div className="mt-8 pt-6 border-t border-stone-100 flex justify-between items-center">
                     <p className="text-stone-500 text-sm font-medium italic">
                       Click the underlined blanks to reveal the words.
                     </p>
                     <div className="flex gap-2">
                        {storyQuiz.wordsUsed.map(w => (
                          <span key={w} className="text-xs px-2 py-1 bg-stone-100 text-stone-500 rounded">
                            {w}
                          </span>
                        ))}
                     </div>
                   </div>
                 </div>
               )}

               {savedItems.length === 0 ? (
                 <div className="text-center py-20 text-stone-400">
                   <GridIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                   <p className="text-xl">No words saved yet.</p>
                   <button 
                      onClick={() => setView('search')}
                      className="mt-4 text-orange-600 font-bold hover:underline"
                   >
                     Start searching
                   </button>
                 </div>
               ) : (
                 <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
                   {savedItems.map((item) => (
                     <div key={item.id} className="break-inside-avoid bg-white rounded-2xl overflow-hidden shadow-md border border-stone-100 group hover:shadow-xl transition-all">
                        <div className="relative aspect-square bg-stone-100">
                           <img src={item.imageUrl} alt={item.word} className="w-full h-full object-cover" />
                           <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                           <button 
                             onClick={() => handleRemoveSavedItem(item.id)}
                             className="absolute top-3 right-3 p-2 bg-white/90 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                             title="Remove from wordbook"
                           >
                             <TrashIcon className="w-4 h-4" />
                           </button>
                        </div>
                        <div className="p-5">
                          <h3 className="text-2xl font-serif font-bold text-stone-900 mb-2 capitalize">{item.word}</h3>
                          <p className="text-stone-600 text-sm line-clamp-3 leading-relaxed">
                            {item.definition}
                          </p>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          ) : (
            /* SEARCH VIEW */
            <>
              {/* Search Section */}
              <div className={`transition-all duration-700 ease-out ${wordData ? 'mb-12' : 'mt-[15vh] mb-16 text-center max-w-2xl mx-auto'}`}>
                {!wordData && (
                  <div className="mb-10 space-y-4 animate-fade-in">
                    <h1 className="text-5xl sm:text-6xl font-serif text-stone-900 font-bold tracking-tight">
                      Words, <span className="text-orange-600 italic">reimagined.</span>
                    </h1>
                    <p className="text-stone-500 text-xl font-light max-w-lg mx-auto">
                      Enter a word to get a rich, visual explanation in your language.
                    </p>
                  </div>
                )}
                
                <form onSubmit={handleSearch} className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                    <SearchIcon className="h-6 w-6 text-stone-400 group-focus-within:text-orange-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-16 pr-6 py-6 bg-white border-2 border-stone-100 rounded-2xl text-2xl font-serif shadow-xl shadow-stone-200/40 placeholder-stone-300 focus:outline-none focus:border-orange-500/50 focus:ring-0 transition-all"
                    placeholder="Search a word..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button 
                    type="submit"
                    disabled={!query.trim() || loadingWord}
                    className="absolute right-3 top-3 bottom-3 px-8 bg-stone-900 text-white rounded-xl font-medium text-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
                  >
                    {loadingWord ? <Loader size="sm" color="text-white" /> : 'Search'}
                  </button>
                </form>
              </div>

              {/* Results Container */}
              {loadingWord && !wordData && (
                <div className="flex flex-col items-center justify-center py-20 space-y-6 animate-pulse">
                  <div className="h-4 w-32 bg-stone-200 rounded-full"></div>
                  <div className="h-64 w-full max-w-3xl bg-stone-200/50 rounded-3xl"></div>
                </div>
              )}

              {wordData && (
                <div className="animate-fade-in">
                  {/* Main Result Card */}
                  <div className="bg-white rounded-[2.5rem] shadow-xl shadow-stone-200/60 border border-white overflow-hidden">
                    
                    {/* 1. Header: Word & Audio */}
                    <div className="px-8 pt-10 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-stone-100">
                      <div>
                          <h2 className="text-6xl sm:text-7xl font-serif font-bold text-stone-900 mb-3 tracking-tight capitalize">
                            {wordData.word}
                          </h2>
                          <div className="flex items-center gap-4 text-xl text-stone-500">
                            <span className="font-mono text-orange-600 font-medium">{wordData.phonetic}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-300"></span>
                            <span className="italic font-serif">{wordData.partOfSpeech}</span>
                          </div>
                      </div>
                      <button 
                          onClick={handleAudioPlay}
                          disabled={loadingAudio}
                          className="group flex items-center gap-3 px-6 py-3 rounded-full bg-stone-50 border border-stone-200 hover:border-orange-200 hover:bg-orange-50 transition-all active:scale-95"
                        >
                          <div className="bg-stone-200 group-hover:bg-orange-200 rounded-full p-2 transition-colors">
                            {loadingAudio ? <Loader size="sm" /> : <VolumeIcon className="w-5 h-5 text-stone-700 group-hover:text-orange-700" />}
                          </div>
                          <span className="font-bold text-stone-600 group-hover:text-orange-800 text-sm">Pronounce</span>
                      </button>
                    </div>

                    {/* 2. Two-Column Layout: Definition vs Image */}
                    <div className="grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-stone-100">
                      
                      {/* LEFT: Textual Deep Dive (7 cols) */}
                      <div className="lg:col-span-7 p-8 sm:p-10 space-y-10">
                        
                        {/* Main Definition (Target Lang) */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="bg-stone-900 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Definition ({targetLanguage})</span>
                          </div>
                          <p className="text-2xl sm:text-3xl text-stone-900 font-serif leading-relaxed">
                            {wordData.definition}
                          </p>
                        </div>

                        {/* Original Language Definition - Highlighted Box */}
                        <div className="bg-orange-50/60 border-l-4 border-orange-400 p-6 rounded-r-xl">
                          <h3 className="text-xs font-bold text-orange-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <BookIcon className="w-4 h-4" />
                            Definition in Original Language
                          </h3>
                          <p className="text-xl text-stone-800 font-medium leading-relaxed">
                            {wordData.originalDefinition}
                          </p>
                        </div>

                        {/* Vibe Check Section */}
                        <div className="py-2">
                          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <ZapIcon className="w-4 h-4 text-yellow-500" />
                              Vibe Check
                          </h3>
                          <div className="flex flex-wrap gap-2">
                              {wordData.vibes.map((vibe, idx) => (
                                <div key={idx} className="px-4 py-3 bg-yellow-50 border-l-4 border-yellow-400 text-stone-800 font-medium rounded-r-lg text-base shadow-sm">
                                  {vibe}
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Examples */}
                        <div>
                          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4 border-b border-stone-100 pb-2">Usage Examples</h3>
                          <ul className="space-y-4">
                            {wordData.examples.map((ex, idx) => (
                              <li key={idx} className="flex gap-4 group">
                                <span className="text-orange-300 text-xl font-serif select-none group-hover:text-orange-500 transition-colors">•</span>
                                <span className="text-lg text-stone-600 leading-relaxed">{ex}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Etymology */}
                        <div>
                          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-2">Origin & History</h3>
                          <p className="text-stone-500 italic font-serif text-lg">
                              {wordData.etymology}
                          </p>
                        </div>
                      </div>

                      {/* RIGHT: Visuals (5 cols) */}
                      <div className="lg:col-span-5 bg-stone-50/50 flex flex-col">
                        <div className="p-8 flex-grow flex flex-col">
                          <div className="flex items-center justify-between mb-4">
                             <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                               <ImageIcon className="w-4 h-4" /> AI Visualization
                             </h3>
                             {currentImage && (
                               <button 
                                 onClick={handleSaveItem}
                                 disabled={isCurrentSaved}
                                 className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                   isCurrentSaved 
                                    ? 'bg-green-100 text-green-700 cursor-default' 
                                    : 'bg-white text-stone-600 shadow-sm hover:bg-orange-50 hover:text-orange-700'
                                 }`}
                               >
                                 <BookmarkIcon filled={isCurrentSaved} className="w-3.5 h-3.5" />
                                 {isCurrentSaved ? 'Saved' : 'Save to Wordbook'}
                               </button>
                             )}
                          </div>
                          
                          {/* Image Container - Big and Bold */}
                          <div className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden shadow-lg bg-white border border-stone-100 group flex-grow">
                              {loadingImage ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-400 bg-stone-100">
                                    <Loader color="text-orange-500" size="lg" />
                                    <span className="text-sm mt-4 font-medium tracking-wide uppercase">Generating Art...</span>
                                </div>
                              ) : currentImage ? (
                                <>
                                  <img 
                                    src={currentImage} 
                                    alt={wordData.word} 
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                                  />
                                  {/* Overlay Badge */}
                                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-stone-900 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
                                    <SparklesIcon className="w-3 h-3 text-orange-500" />
                                    AI GENERATED
                                  </div>
                                </>
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-300">
                                  <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                                  <span className="text-sm font-medium">No image available</span>
                                </div>
                              )}
                          </div>

                          {/* Thumbnails */}
                          {gallery.length > 1 && (
                            <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                                {gallery.map((img, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setActiveImageIndex(idx)}
                                    className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                                      activeImageIndex === idx ? 'border-orange-500 opacity-100 ring-2 ring-orange-200' : 'border-transparent opacity-50 hover:opacity-100'
                                    }`}
                                  >
                                    <img src={img} alt="thumb" className="w-full h-full object-cover" />
                                  </button>
                                ))}
                            </div>
                          )}

                          {/* Action Buttons under Image */}
                          <div className="mt-6 space-y-4">
                              <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-stone-200 shadow-sm">
                                  <span className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-3">Feedback</span>
                                  <div className="flex gap-1">
                                    <button 
                                      onClick={() => toggleFeedback('like')} 
                                      className={`p-2 rounded-lg transition-colors ${currentFeedback === 'like' ? 'text-green-600 bg-green-50' : 'text-stone-400 hover:bg-stone-50 hover:text-stone-600'}`}
                                    >
                                      <ThumbsUpIcon filled={currentFeedback === 'like'} className="w-5 h-5" />
                                    </button>
                                    <button 
                                      onClick={() => toggleFeedback('dislike')} 
                                      className={`p-2 rounded-lg transition-colors ${currentFeedback === 'dislike' ? 'text-red-500 bg-red-50' : 'text-stone-400 hover:bg-stone-50 hover:text-stone-600'}`}
                                    >
                                      <ThumbsDownIcon filled={currentFeedback === 'dislike'} className="w-5 h-5" />
                                    </button>
                                  </div>
                              </div>

                              <button 
                                onClick={handleGenerateNewImage}
                                disabled={loadingNewImage}
                                className="w-full py-4 rounded-xl bg-stone-900 text-white font-bold text-sm hover:bg-orange-600 transition-colors flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-stone-200"
                              >
                                {loadingNewImage ? <Loader size="sm" color="text-white" /> : <RefreshIcon className="w-4 h-4" />}
                                <span>GENERATE VARIATION</span>
                              </button>
                          </div>

                        </div>
                      </div>

                    </div>

                    {/* 3. Footer: Hidden Gems */}
                    <div className="bg-[#1c1917] p-8 sm:p-10 text-stone-300">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
                            <SparklesIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-xl font-serif font-bold text-white">Hidden Gems</h3>
                            <p className="text-sm text-stone-400">Trivia, slang, and cultural secrets.</p>
                          </div>
                        </div>
                        
                        {!additionalMeanings && (
                          <button 
                            onClick={handleLoadMoreMeanings}
                            disabled={loadingMoreMeanings}
                            className="group relative px-6 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 text-white font-bold text-sm shadow-lg shadow-orange-900/50 hover:shadow-orange-600/40 transition-all overflow-hidden"
                          >
                            <span className="relative z-10 flex items-center gap-2">
                              {loadingMoreMeanings ? <Loader size="sm" color="text-white" /> : <ZapIcon className="w-4 h-4" />}
                              <span>{loadingMoreMeanings ? 'Unearthing...' : 'Reveal Secrets'}</span>
                            </span>
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                          </button>
                        )}
                      </div>

                      {additionalMeanings && (
                          <div className="grid md:grid-cols-3 gap-4 animate-fade-in">
                            {additionalMeanings.map((m, i) => (
                              <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/10 p-5 rounded-2xl hover:bg-white/15 transition-colors group">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></span>
                                  <span className="text-xs font-bold uppercase tracking-widest text-orange-400 group-hover:text-orange-300 transition-colors">
                                    {m.context}
                                  </span>
                                </div>
                                <p className="text-stone-200 font-medium leading-relaxed">{m.definition}</p>
                              </div>
                            ))}
                          </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Chat Button (Floating) */}
      {view === 'search' && wordData && (
        <div className="fixed bottom-8 right-8 z-30">
           {!isChatOpen && (
             <button
               onClick={() => setIsChatOpen(true)}
               className="group flex items-center gap-3 bg-stone-900 text-white pl-6 pr-4 py-4 rounded-full shadow-2xl hover:bg-orange-600 transition-all hover:scale-105 active:scale-95"
             >
               <span className="font-bold tracking-wide">Ask AI</span>
               <div className="bg-white/20 rounded-full p-2 group-hover:rotate-12 transition-transform">
                 <MessageCircleIcon className="w-5 h-5" />
               </div>
             </button>
           )}
        </div>
      )}

      {/* Chat Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white shadow-2xl transform transition-transform duration-400 cubic-bezier(0.16, 1, 0.3, 1) z-40 flex flex-col border-l border-stone-200 ${
          isChatOpen && view === 'search' ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Chat Header */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <div>
             <h3 className="font-serif font-bold text-2xl text-stone-900">Tutor Chat</h3>
             <p className="text-sm text-stone-500">Discussing "{wordData?.word}"</p>
          </div>
          <button 
            onClick={() => setIsChatOpen(false)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-stone-200 text-stone-500 transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-white">
          {chatMessages.length === 0 && (
            <div className="text-center mt-12">
               <div className="w-16 h-16 mx-auto bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mb-4">
                 <MessageCircleIcon className="w-8 h-8" />
               </div>
               <p className="text-stone-600 font-medium">
                 What else would you like to know?
               </p>
               <div className="mt-8 flex flex-col gap-3">
                 {["Give me a quiz.", "Is this word formal?", "Translate a sentence."].map(q => (
                   <button 
                    key={q}
                    onClick={() => { setChatInput(q); }}
                    className="text-left px-5 py-4 bg-stone-50 border border-stone-100 rounded-xl text-stone-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-800 transition-all font-medium text-sm"
                   >
                     "{q}"
                   </button>
                 ))}
               </div>
            </div>
          )}
          
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-5 py-4 text-base leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-stone-900 text-white rounded-br-none' 
                  : 'bg-stone-100 text-stone-800 rounded-bl-none'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isChatSending && (
             <div className="flex justify-start">
               <div className="bg-stone-100 rounded-2xl rounded-bl-none px-5 py-4">
                 <div className="flex gap-1.5">
                   <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"></span>
                   <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce delay-75"></span>
                   <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce delay-150"></span>
                 </div>
               </div>
             </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-5 bg-white border-t border-stone-100">
          <form onSubmit={handleChatSubmit} className="relative">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="w-full pl-5 pr-14 py-4 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium text-stone-800 placeholder-stone-400"
            />
            <button 
              type="submit"
              disabled={!chatInput.trim() || isChatSending}
              className="absolute right-3 top-3 bottom-3 px-3 text-orange-600 disabled:text-stone-300 hover:bg-orange-50 rounded-lg transition-colors"
            >
              <SendIcon className="w-6 h-6" />
            </button>
          </form>
        </div>
      </div>

      {/* Overlay for mobile chat */}
      {isChatOpen && view === 'search' && (
        <div 
          className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-30 sm:hidden"
          onClick={() => setIsChatOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
