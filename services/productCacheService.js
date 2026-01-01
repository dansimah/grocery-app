const fs = require('fs').promises;
const path = require('path');

class ProductCacheService {
    constructor() {
        this.cachePath = path.join(__dirname, '../data/product_cache.json');
        this.cache = {};
        this.loaded = false;
    }

    // Load cache from file
    async loadCache() {
        try {
            const data = await fs.readFile(this.cachePath, 'utf-8');
            this.cache = JSON.parse(data);
            this.loaded = true;
            console.log(`📦 Loaded product cache with ${Object.keys(this.cache).length} products`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, start with empty cache
                this.cache = {};
                this.loaded = true;
                console.log('📦 Product cache file not found, starting with empty cache');
            } else {
                console.error('Error loading product cache:', error);
                this.cache = {};
                this.loaded = true;
            }
        }
    }

    // Save cache to file
    async saveCache() {
        try {
            await fs.writeFile(this.cachePath, JSON.stringify(this.cache, null, 2), 'utf-8');
            console.log(`💾 Saved product cache with ${Object.keys(this.cache).length} products`);
        } catch (error) {
            console.error('Error saving product cache:', error);
        }
    }

    // Ensure cache is loaded
    async ensureLoaded() {
        if (!this.loaded) {
            await this.loadCache();
        }
    }

    // Normalize text for matching (lowercase, trim)
    normalizeText(text) {
        return text.toLowerCase().trim();
    }

    // Extract quantity and product name from a line
    // Examples: 
    //   "2 pommes" -> { quantity: 2, product: "pommes" }
    //   "pommes 2" -> { quantity: 2, product: "pommes" }
    //   "2 פיצה" -> { quantity: 2, product: "פיצה" }
    //   "קליק 3" -> { quantity: 3, product: "קליק" }
    //   "pommes" -> { quantity: 1, product: "pommes" }
    parseLineForProduct(line) {
        const trimmed = line.trim();
        
        // Pattern 1: Quantity first (e.g., "2 pommes", "3 apples", "2 פיצה")
        // Match: digits + space(s) + product name (any characters including Hebrew)
        const qtyFirstMatch = trimmed.match(/^(\d+)\s+(.+)$/u);
        if (qtyFirstMatch) {
            const qty = parseInt(qtyFirstMatch[1]);
            const product = qtyFirstMatch[2].trim();
            if (!isNaN(qty) && product.length > 0) {
                return { quantity: qty, product: product };
            }
        }

        // Pattern 2: Quantity last (e.g., "pommes 2", "tomate 2", "קליק 3")
        // Match: product name (any characters including Hebrew) + space(s) + digits
        const qtyLastMatch = trimmed.match(/^(.+)\s+(\d+)$/u);
        if (qtyLastMatch) {
            const product = qtyLastMatch[1].trim();
            const qty = parseInt(qtyLastMatch[2]);
            if (!isNaN(qty) && product.length > 0) {
                return { quantity: qty, product: product };
            }
        }
        
        // No quantity found, return whole line as product with quantity 1
        return {
            quantity: 1,
            product: trimmed
        };
    }

    // Find a product in cache by exact name or variant
    findProduct(productName) {
        const normalized = this.normalizeText(productName);
        
        // Check if it's a key (correct name)
        if (this.cache[normalized]) {
            return this.cache[normalized];
        }
        
        // Check if it's a variant of any product
        for (const [key, product] of Object.entries(this.cache)) {
            if (product.variants && product.variants.includes(normalized)) {
                return product;
            }
        }
        
        return null;
    }

    // Parse grocery text with cache
    // Returns: { cachedItems: [...], unparsedLines: [...] }
    async parseWithCache(groceryText) {
        await this.ensureLoaded();
        
        const lines = groceryText.split('\n').filter(line => line.trim().length > 0);
        const cachedItems = [];
        const unparsedLines = [];
        
        for (const line of lines) {
            const { quantity, product } = this.parseLineForProduct(line);
            const cachedProduct = this.findProduct(product);
            
            if (cachedProduct) {
                // Found in cache
                cachedItems.push({
                    article: cachedProduct.correctName,
                    quantity: quantity,
                    category: cachedProduct.category,
                    originalInput: line.trim()
                });
                console.log(`✅ Cache hit: "${line}" → ${cachedProduct.correctName} [${cachedProduct.category}]`);
            } else {
                // Not in cache, needs Gemini
                unparsedLines.push(line);
                console.log(`❌ Cache miss: "${line}"`);
            }
        }
        
        console.log(`📊 Cache stats: ${cachedItems.length} cached, ${unparsedLines.length} need AI`);
        return { cachedItems, unparsedLines };
    }

    // Add or update a product with a new variant
    async addProductVariant(correctName, category, variant) {
        await this.ensureLoaded();
        
        const normalizedCorrectName = this.normalizeText(correctName);
        const normalizedVariant = this.normalizeText(variant);
        
        // Don't add if variant is same as correct name
        if (normalizedCorrectName === normalizedVariant) {
            console.log(`ℹ️ Skipping variant (same as correct name): ${variant}`);
            return;
        }
        
        // Initialize product if it doesn't exist
        if (!this.cache[normalizedCorrectName]) {
            this.cache[normalizedCorrectName] = {
                correctName: correctName,
                category: category,
                variants: []
            };
            console.log(`➕ Added new product to cache: ${correctName} [${category}]`);
        } else {
            // Update category if it changed
            this.cache[normalizedCorrectName].category = category;
        }
        
        // Add variant if not already present
        if (!this.cache[normalizedCorrectName].variants.includes(normalizedVariant)) {
            this.cache[normalizedCorrectName].variants.push(normalizedVariant);
            console.log(`📝 Added variant "${variant}" for product "${correctName}"`);
        }
        
        // Save to file
        await this.saveCache();
    }

    // Get cache statistics
    async getStats() {
        await this.ensureLoaded();
        
        const productCount = Object.keys(this.cache).length;
        const variantCount = Object.values(this.cache).reduce(
            (sum, product) => sum + (product.variants ? product.variants.length : 0), 
            0
        );
        
        return {
            products: productCount,
            variants: variantCount,
            total: productCount + variantCount
        };
    }
}

// Create singleton instance
const productCacheService = new ProductCacheService();

module.exports = productCacheService;
