// src/utils/transactionParser.js

export class TransactionParser {
  static async parse(input) {
    try {
      // Get categories for matching
      const { data: categories } = await window.databaseApi.fetchCategories();
      
      // Normalize input
      const normalizedInput = input.trim().toLowerCase();
      
      // Extract and calculate amount
      const { amount, remainingText } = this.extractAmount(normalizedInput);
      if (!amount) return null;

      // Determine if it's likely income
      const isLikelyIncome = remainingText.toLowerCase().includes('payroll') || 
                            remainingText.toLowerCase().includes('deposit') ||
                            remainingText.toLowerCase().includes('salary') ||
                            remainingText.toLowerCase().includes('payment from');

      // Find matching category and determine type
      const { 
        category_id, 
        type, 
        categoryName, 
        remainingDescription 
      } = this.findCategoryAndType(remainingText, categories, isLikelyIncome);

      // Clean up description
      const description = this.cleanDescription(remainingDescription, categoryName);

      return {
        amount,
        type: type || isLikelyIncome ? 'income' : 'expense',
        category_id,
        categoryName,
        description,
        date: new Date().toISOString().split('T')[0]
      };
    } catch (error) {
      console.error('Transaction parsing error:', error);
      return null;
    }
  }

  static extractAmount(text) {
    // Try to find mathematical expressions first (including decimals)
    const mathRegex = /(?:^|\s)([-+]?\d*\.?\d+(?:\s*[-+*/]\s*\d*\.?\d+)+)/;
    const mathMatch = text.match(mathRegex);

    if (mathMatch) {
        try {
            // Split the expression into numbers and operators
            const expression = mathMatch[1].replace(/\s+/g, '');
            const numbers = expression.split(/[-+*/]/).filter(Boolean);
            const operators = expression.match(/[-+*/]/g);

            // Calculate result following order of operations
            let result = parseFloat(numbers[0]);
            for (let i = 0; i < operators.length; i++) {
                const nextNum = parseFloat(numbers[i + 1]);
                switch (operators[i]) {
                    case '*':
                        result *= nextNum;
                        break;
                    case '/':
                        result /= nextNum;
                        break;
                    case '+':
                        result += nextNum;
                        break;
                    case '-':
                        result -= nextNum;
                        break;
                }
            }

            const remainingText = text.replace(mathMatch[1], '').trim();
            return { 
                amount: Math.abs(result), // Store absolute value
                remainingText 
            };
        } catch (error) {
            console.error('Math parsing error:', error);
        }
    }

    // If no math expression found or calculation failed, try simple number
    const simpleNumberRegex = /(?:^|\s)([-+]?\d*\.?\d+)/;
    const simpleMatch = text.match(simpleNumberRegex);

    if (simpleMatch) {
        const amount = parseFloat(simpleMatch[1]);
        const remainingText = text.replace(simpleMatch[1], '').trim();
        return { amount: Math.abs(amount), remainingText };
    }

    return { amount: null, remainingText: text };
  }

  static findCategoryAndType(text, categories, isLikelyIncome) {
    if (!categories || !Array.isArray(categories)) {
        return {
            category_id: null,
            type: null,
            categoryName: null,
            remainingDescription: text
        };
    }

    // Define semantic groups for common categories
    const categoryAssociations = {
      'dining out': [
          'lunch', 'dinner', 'breakfast', 'brunch', 'restaurant', 'cafe', 'food', 'meal', 
          'takeout', 'take-out', 'eating out', 'dine', 'dining', 'bistro', 'eatery', 
          'pizzeria', 'sushi', 'thai', 'chinese', 'mexican', 'italian', 'burger', 'sandwich',
          'fast food', 'mcdonalds', 'wendys', 'burger king', 'subway', 'chipotle', 'panera',
          'olive garden', 'applebees', 'chilis', 'taco bell', 'kfc', 'pizza hut', 'dominos',
          'buffet', 'steakhouse', 'seafood', 'barbecue', 'bbq', 'grill', 'bar', 'pub',
          'cafeteria', 'food court', 'food truck', 'delivery', 'doordash', 'ubereats',
          'grubhub', 'postmates', 'seamless'
      ],
      'groceries': [
          'food', 'grocery', 'supermarket', 'market', 'produce', 'vegetables', 'fruits', 
          'meat', 'dairy', 'bread', 'pantry', 'ingredients', 'walmart', 'target', 'costco',
          'sam\'s club', 'aldi', 'trader joe\'s', 'whole foods', 'safeway', 'kroger',
          'publix', 'food lion', 'giant', 'stop & shop', 'wegmans', 'fresh market',
          'sprouts', 'organic', 'beverages', 'snacks', 'frozen', 'canned goods',
          'household items', 'cleaning supplies', 'paper products', 'personal care'
      ],
      'entertainment': [
          'movie', 'cinema', 'theatre', 'theater', 'show', 'concert', 'game', 'fun', 
          'entertainment', 'netflix', 'netflix.com', 'hulu', 'disney+', 'streaming', 'spotify', 'apple music',
          'amazon prime', 'hbo', 'showtime', 'youtube', 'twitch', 'video games', 'playstation',
          'xbox', 'nintendo', 'steam', 'amusement park', 'theme park', 'disney', 'universal',
          'six flags', 'museum', 'zoo', 'aquarium', 'bowling', 'arcade', 'laser tag',
          'mini golf', 'sports event', 'concert', 'festival', 'fair', 'circus', 'theater',
          'broadway', 'play', 'musical', 'comedy show', 'stand-up', 'live music'
      ],
      'transportation': [
          'gas', 'fuel', 'uber', 'lyft', 'taxi', 'cab', 'bus', 'train', 'metro', 'subway',
          'transport', 'parking', 'toll', 'car service', 'shuttle', 'ride share', 'rideshare',
          'car wash', 'oil change', 'maintenance', 'repair', 'tires', 'auto parts',
          'registration', 'license', 'inspection', 'car payment', 'auto loan', 'lease',
          'insurance', 'rental car', 'zipcar', 'scooter', 'bike share', 'plane', 'flight',
          'airline', 'travel', 'transit', 'commute', 'mileage'
      ],
      'utilities': [
          'electric', 'electricity', 'water', 'gas', 'heat', 'utility', 'bill', 'power',
          'energy', 'sewage', 'waste', 'garbage', 'trash', 'internet', 'wifi', 'cable',
          'phone', 'mobile', 'cell phone', 'landline', 'broadband', 'fiber', 'satellite',
          'solar', 'utilities', 'connection', 'service provider', 'at&t', 'verizon',
          't-mobile', 'sprint', 'comcast', 'xfinity', 'spectrum', 'cox', 'pg&e'
      ],
      'rent': [
          'rent', 'lease', 'housing', 'apartment', 'house payment', 'mortgage', 'landlord',
          'property', 'real estate', 'condo', 'townhouse', 'studio', 'room', 'housing',
          'accommodation', 'living space', 'rental', 'deposit', 'security deposit',
          'maintenance fee', 'hoa', 'homeowners association', 'property tax'
      ],
      'shopping': [
          'clothes', 'clothing', 'shoes', 'apparel', 'mall', 'store', 'retail', 'amazon',
          'online shopping', 'fashion', 'accessories', 'jewelry', 'watch', 'handbag',
          'wallet', 'electronics', 'gadgets', 'computer', 'phone', 'laptop', 'tablet',
          'furniture', 'home goods', 'decor', 'bedding', 'kitchenware', 'appliances',
          'tools', 'hardware', 'office supplies', 'books', 'gifts', 'makeup', 'cosmetics',
          'beauty', 'skincare', 'haircare', 'department store', 'outlet', 'boutique',
          'thrift store', 'consignment', 'ebay', 'etsy', 'wayfair', 'best buy', 'apple store',
          'nike', 'adidas', 'h&m', 'zara', 'nordstrom', 'macys', 'kohls', 'target'
      ],
      'healthcare': [
          'doctor', 'medical', 'health', 'dentist', 'pharmacy', 'medicine', 'prescription',
          'hospital', 'clinic', 'urgent care', 'emergency room', 'er', 'specialist',
          'physician', 'surgeon', 'therapy', 'physical therapy', 'mental health',
          'psychiatrist', 'psychologist', 'counseling', 'optometrist', 'eye doctor',
          'glasses', 'contacts', 'dental', 'orthodontist', 'chiropractor', 'lab work',
          'blood work', 'x-ray', 'mri', 'ct scan', 'vaccination', 'immunization',
          'insurance', 'copay', 'deductible', 'cvs', 'walgreens', 'rite aid'
      ],
      'income': [
          'salary', 'wage', 'payment', 'deposit', 'paycheck', 'commission', 'bonus',
          'revenue', 'earnings', 'compensation', 'overtime', 'tip', 'tips', 'gratuity',
          'freelance', 'contract', 'consulting', 'side gig', 'investment', 'dividend',
          'interest', 'rent income', 'royalty', 'pension', 'social security', 'welfare',
          'unemployment', 'tax refund', 'reimbursement', 'rebate', 'cashback'
      ],
      'coffee': [
          'coffee', 'starbucks', 'cafe', 'latte', 'espresso', 'cappuccino', 'mocha',
          'americano', 'cold brew', 'frappuccino', 'tea', 'chai', 'matcha', 'dunkin',
          'peets', 'coffee bean', 'caribou coffee', 'dutch bros', 'tim hortons',
          'costa coffee', 'blue bottle', 'philz', 'coffee shop', 'barista', 'brew'
      ]
    };

    let bestMatch = {
        category_id: null,
        type: null,
        categoryName: null,
        score: 0
    };

    const words = text.toLowerCase().split(' ');

    for (const category of categories) {
        let matchScore = 0;
        const categoryLower = category.name.toLowerCase();
        
        // Direct match check (increased weight)
        if (text.toLowerCase().includes(categoryLower)) {
            matchScore += 2;  // Increased from 1 to 2
        }

        // Word-by-word match check (new)
        const categoryWords = categoryLower.split(' ');
        for (const word of words) {
            if (categoryWords.includes(word)) {
                matchScore += 0.5;
            }
        }

        // Check category associations with more lenient matching
        for (const [groupName, associations] of Object.entries(categoryAssociations)) {
            // More lenient Levenshtein distance
            if (this.levenshteinDistance(categoryLower, groupName) <= 3) {  // Increased from 2 to 3
                for (const word of words) {
                    if (associations.includes(word.toLowerCase())) {
                        matchScore += 0.5;  // Reduced from 0.8 to encourage multiple matches
                    }
                }
            }
        }

        if (matchScore > bestMatch.score) {
            bestMatch = {
                category_id: category.id,
                type: category.type,
                categoryName: category.name.toLowerCase(),
                score: matchScore
            };
        }
    }

    // More lenient threshold
    const useCategory = bestMatch.score >= 0.2;  // Reduced from 0.3 to 0.2
    
    return {
        category_id: useCategory ? bestMatch.category_id : null,
        type: useCategory ? bestMatch.type : null,
        categoryName: useCategory ? bestMatch.categoryName : null,
        remainingDescription: text
    };
  }

  static cleanDescription(text, categoryName) {
    if (!text) return '';
    
    let description = text;
    
    // Remove category name from description if present
    if (categoryName) {
      description = description.replace(new RegExp(categoryName, 'gi'), '');
    }
    
    // Clean up common separators and extra spaces
    description = description
      .replace(/[-_|,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Capitalize first letter
    return description.charAt(0).toUpperCase() + description.slice(1);
  }

  static levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}