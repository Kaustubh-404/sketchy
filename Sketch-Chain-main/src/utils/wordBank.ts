export const WORD_CATEGORIES = {
    animals: [
      'dog', 'cat', 'elephant', 'giraffe', 'lion', 'tiger', 'penguin', 'zebra',
      'monkey', 'kangaroo', 'panda', 'koala', 'dolphin', 'whale', 'octopus'
    ],
    objects: [
      'chair', 'table', 'lamp', 'phone', 'computer', 'book', 'pencil', 'clock',
      'glasses', 'umbrella', 'camera', 'television', 'mirror', 'window', 'door'
    ],
    food: [
      'pizza', 'burger', 'sushi', 'pasta', 'sandwich', 'taco', 'cookie', 'cake',
      'ice cream', 'chocolate', 'banana', 'apple', 'carrot', 'broccoli'
    ],
    places: [
      'beach', 'mountain', 'park', 'school', 'hospital', 'airport', 'library',
      'restaurant', 'museum', 'zoo', 'farm', 'forest', 'desert', 'castle'
    ],
    vehicles: [
      'car', 'bus', 'train', 'airplane', 'bicycle', 'motorcycle', 'helicopter',
      'boat', 'ship', 'rocket', 'submarine', 'truck', 'scooter'
    ]
  } as const;
  
  export const getRandomWord = (): string => {
    const categories = Object.keys(WORD_CATEGORIES);
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const words = WORD_CATEGORIES[randomCategory as keyof typeof WORD_CATEGORIES];
    return words[Math.floor(Math.random() * words.length)];
  };