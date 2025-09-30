export interface AestheticContent {
  id: string;
  image: string;
  title: string;
  description: string;
  category: 'professional' | 'casual' | 'date-night' | 'gym' | 'street' | 'vintage' | 'minimalist' | 'bohemian';
  gender: 'men' | 'women' | 'unisex';
  tags: string[];
}

export const aestheticContent: AestheticContent[] = [
  // Professional Wear
  {
    id: '1',
    image: 'https://i.pinimg.com/736x/90/38/d5/9038d54c63253a6d5575e33cd7aab25b.jpg',
    title: 'Executive Power Suit',
    description: 'Sharp tailoring meets modern sophistication. Perfect for boardrooms and important meetings.',
    category: 'professional',
    gender: 'men',
    tags: ['business', 'formal', 'suit']
  },
  {
    id: '2',
    image: 'https://i.pinimg.com/736x/90/38/d5/9038d54c63253a6d5575e33cd7aab25b.jpg',
    title: 'Corporate Elegance',
    description: 'Professional blazers and tailored pieces that command respect and confidence.',
    category: 'professional',
    gender: 'women',
    tags: ['business', 'blazer', 'professional']
  },
  
  // Casual Wear
  {
    id: '3',
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=800&fit=crop&q=80',
    title: 'Weekend Casual',
    description: 'Effortless style for relaxed days. Comfort meets fashion in perfect harmony.',
    category: 'casual',
    gender: 'men',
    tags: ['relaxed', 'comfortable', 'weekend']
  },
  {
    id: '4',
    image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&h=800&fit=crop&q=80',
    title: 'Casual Chic',
    description: 'Elevated everyday wear that transitions seamlessly from day to night.',
    category: 'casual',
    gender: 'women',
    tags: ['everyday', 'versatile', 'chic']
  },
  
  // Date Night
  {
    id: '5',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop&q=80',
    title: 'Romantic Evening',
    description: 'Sophisticated elegance for special moments. Make a lasting impression.',
    category: 'date-night',
    gender: 'men',
    tags: ['romantic', 'elegant', 'evening']
  },
  {
    id: '6',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=800&fit=crop&q=80',
    title: 'Date Night Glamour',
    description: 'Stunning silhouettes and luxurious fabrics for unforgettable evenings.',
    category: 'date-night',
    gender: 'women',
    tags: ['glamorous', 'elegant', 'evening']
  },
  
  // Gym Wear
  {
    id: '7',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=800&fit=crop&q=80',
    title: 'Athletic Performance',
    description: 'High-performance activewear that keeps you comfortable during intense workouts.',
    category: 'gym',
    gender: 'men',
    tags: ['athletic', 'performance', 'workout']
  },
  {
    id: '8',
    image: 'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=600&h=800&fit=crop&q=80',
    title: 'Fitness Fashion',
    description: 'Stylish activewear that performs as well as it looks. Function meets fashion.',
    category: 'gym',
    gender: 'women',
    tags: ['athletic', 'stylish', 'fitness']
  },
  
  // Street Style
  {
    id: '9',
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=800&fit=crop&q=80',
    title: 'Urban Streetwear',
    description: 'Bold street style that makes a statement. Urban fashion at its finest.',
    category: 'street',
    gender: 'men',
    tags: ['urban', 'bold', 'streetwear']
  },
  {
    id: '10',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&h=800&fit=crop&q=80',
    title: 'Street Style Queen',
    description: 'Edgy and confident street fashion that turns heads wherever you go.',
    category: 'street',
    gender: 'women',
    tags: ['edgy', 'confident', 'urban']
  },
  
  // Vintage
  {
    id: '11',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=800&fit=crop&q=80',
    title: 'Retro Revival',
    description: 'Classic vintage pieces with modern twists. Timeless style reimagined.',
    category: 'vintage',
    gender: 'men',
    tags: ['vintage', 'retro', 'classic']
  },
  {
    id: '12',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop&q=80',
    title: 'Vintage Glamour',
    description: 'Elegant vintage-inspired looks that capture the essence of bygone eras.',
    category: 'vintage',
    gender: 'women',
    tags: ['vintage', 'glamorous', 'elegant']
  },
  
  // Minimalist
  {
    id: '13',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop&q=80',
    title: 'Minimalist Mastery',
    description: 'Less is more. Clean lines and quality pieces create timeless elegance.',
    category: 'minimalist',
    gender: 'unisex',
    tags: ['minimal', 'clean', 'timeless']
  },
  
  // Bohemian
  {
    id: '14',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=800&fit=crop&q=80',
    title: 'Bohemian Spirit',
    description: 'Free-spirited fashion with flowing fabrics and artistic flair.',
    category: 'bohemian',
    gender: 'women',
    tags: ['bohemian', 'artistic', 'free-spirited']
  }
];

export const dailyGreetings = [
  "Heyyy, {name}! ✨",
  "What's up, {name}! 🌟",
  "Ready to slay, {name}! 💫",
  "Let's go, {name}! 🚀",
  "You're glowing, {name}! ✨",
  "Time to shine, {name}! 🌈",
  "Looking fierce, {name}! 🔥",
  "You've got this, {name}! 💪",
  "Style mode: ON, {name}! 👑",
  "Let's create magic, {name}! ✨",
  "You're unstoppable, {name}! ⚡",
  "Ready to turn heads, {name}! 💃",
  "Your style is everything, {name}! 🌟",
  "Let's make today fabulous, {name}! 🎭",
  "You're a fashion icon, {name}! 👗"
];
