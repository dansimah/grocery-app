const { GoogleGenerativeAI } = require('@google/generative-ai');
const { BOT_CONFIG } = require('../config/bot');
const { CATEGORIES } = require('../config/categories');

class AIService {
    constructor() {
        if (!BOT_CONFIG.GOOGLE_API_KEY) {
            throw new Error('GOOGLE_API_KEY is required');
        }
        this.genAI = new GoogleGenerativeAI(BOT_CONFIG.GOOGLE_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: BOT_CONFIG.GEMINI_MODEL });
    }

    async parseGroceryItems(groceryText) {
        try {
            console.log('🔍 AI Input Text:', JSON.stringify(groceryText));
            const prompt = this.buildGroceryParsingPrompt(groceryText);
            
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            console.log('🤖 AI Raw Response:', text);

            // Try to parse the JSON response
            let parsedItems;
            try {
                // Clean the response by removing markdown code blocks
                const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
                console.log('🧹 AI Cleaned Response:', cleanedText);
                parsedItems = JSON.parse(cleanedText);
            } catch (parseError) {
                console.error('Failed to parse AI response as JSON:', text);
                throw new Error('AI response was not valid JSON');
            }

            // Validate the response structure
            if (!Array.isArray(parsedItems)) {
                throw new Error('AI response was not an array');
            }

            // Validate each item has required fields
            const validatedItems = parsedItems.map(item => {
                if (!item.article || !item.category) {
                    throw new Error('AI response missing required fields');
                }
                
                return {
                    article: item.article.trim(),
                    quantity: parseInt(item.quantity) || 1,
                    category: item.category.trim()
                };
            });

            console.log(`✅ AI parsed ${validatedItems.length} items from grocery list`);
            return validatedItems;

        } catch (error) {
            console.error('Error parsing grocery items with AI:', error);
            throw new Error(`Failed to parse grocery items: ${error.message}`);
        }
    }

    buildGroceryParsingPrompt(groceryText) {
        const categoriesList = CATEGORIES.join(', ');
        
        return `SYSTEM: You are a grocery list parser that corrects spelling and grammar errors in French grocery lists. Each LINE is ONE COMPLETE item name. NEVER split words within a line.

EXAMPLES OF CORRECT PARSING:
Input line: "Oeuf Dan" → ONE item: {"article": "Oeuf Dan", "quantity": 1, "category": "Produits laitiers"}
Input line: "Pain complet" → ONE item: {"article": "Pain complet", "quantity": 1, "category": "Boulangerie"}
Input line: "2 pommes" → ONE item: {"article": "pommes", "quantity": 2, "category": "Fruits et légumes"}
Input line: "Chocolat noir noisettes" → ONE item: {"article": "Chocolat noir noisettes", "quantity": 1, "category": "Épicerie"}

WRONG (DO NOT DO THIS):
Input line: "Oeuf Dan" → DO NOT create two items for "Oeuf" and "Dan"
Input line: "Pain complet" → DO NOT create two items for "Pain" and "complet"

Categories available: ${categoriesList}

RULES:
1. FIRST: Correct any spelling and grammar errors in the French text
2. Each line = exactly ONE item in output JSON
3. Keep complete item names together (all words on same line = one item name)
4. Extract quantity if mentioned (e.g., "2 pommes" → quantity: 2, article: "pommes")
5. If a word is in Hebrew, keep it in Hebrew and categorize it according to its meaning
6. If you don't understand a word, return it with "Unknown" category
7. Use "Unknown" if unsure about category
8. Do NOT add any items that are not in the input list
9. Return ONLY valid JSON array, no other text

Parse and correct this French grocery list (each line is one item):
${groceryText}`;
    }
}

// Create singleton instance
const aiService = new AIService();

module.exports = aiService; 