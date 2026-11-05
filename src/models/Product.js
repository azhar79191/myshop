import mongoose from 'mongoose';
import { productSlug } from '../utils/productSlug.js';

const sizeSchema = new mongoose.Schema(
  {
    stockStatus: { type: String, enum: ['In Stock', 'Low Stock', 'Out of Stock'] },
    size: {
      type: String,
      required: [true, 'Size is required'],
      maxlength: [100, 'Pack size cannot exceed 100 characters'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
  },
  { _id: true },
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      maxlength: [50, 'Category cannot exceed 50 characters'],
    },
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
      maxlength: [50, 'Brand cannot exceed 50 characters'],
    },
    image: {
      type: String,
      required: [true, 'Product image is required'],
    },
    images: {
      type: [String],
      default: [],
    },
    sizes: {
      type: [sizeSchema],
      validate: {
        validator: function (v) {
          return (
            v &&
            v.length > 0 &&
            v.length <= 30 &&
            new Set(v.map((pack) => pack.size?.trim().toLowerCase())).size === v.length
          );
        },
        message: 'Provide 1–30 packs with unique size names and prices',
      },
    },
    stockStatus: {
      type: String,
      enum: ['In Stock', 'Low Stock', 'Out of Stock'],
      default: 'In Stock',
    },
    crops: {
      type: [String],
      default: [],
      validate: (v) => v.length <= 30 && v.every((s) => s.length <= 80),
    },
    searchAliases: {
      type: [{ type: String, trim: true, maxlength: 100 }],
      default: [],
      validate: (v) => v.length <= 30 && v.every((name) => name.length > 0),
    },
    activeIngredient: { type: String, trim: true, maxlength: 300 },
    formulation: { type: String, trim: true, maxlength: 100 },
    targetProblems: {
      type: [String],
      default: [],
      validate: (v) => v.length <= 30 && v.every((s) => s.length <= 100),
    },
    labelUrl: {
      type: String,
      trim: true,
      validate: (v) => {
        if (!v) return true;
        try {
          return new URL(v).protocol === 'https:';
        } catch {
          return false;
        }
      },
    },
    translations: {
      ur: {
        name: { type: String, maxlength: 200 },
        description: { type: String, maxlength: 3000 },
        usage: { type: String, maxlength: 4000 },
      },
    },
    usage: {
      type: String,
      trim: true,
      maxlength: [3000, 'Usage info cannot exceed 3000 characters'],
    },
    featured: {
      type: Boolean,
      default: false,
    },
    ratings: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Compound indexes for common query patterns
productSchema.index({ name: 'text', description: 'text', brand: 'text', category: 'text' });
productSchema.index({ category: 1, brand: 1, stockStatus: 1 }); // For filtered queries
productSchema.index({ featured: 1, stockStatus: 1, createdAt: -1 }); // For featured products
productSchema.index({ createdAt: -1 }); // For sorting by date
productSchema.index({ 'sizes.price': 1 }); // For price range queries
productSchema.index({ stockStatus: 1 }); // For stock filtering

productSchema.pre('validate', function (next) {
  if (this.sizes?.length && this.sizes.every((pack) => pack.stockStatus)) {
    this.stockStatus = this.sizes.some((pack) => pack.stockStatus === 'In Stock')
      ? 'In Stock'
      : this.sizes.some((pack) => pack.stockStatus === 'Low Stock')
        ? 'Low Stock'
        : 'Out of Stock';
  }
  next();
});
productSchema.index({ crops: 1 });
// Pre-save middleware to generate slug
productSchema.pre('save', function (next) {
  if (!this.slug && this.isModified('name')) {
    this.slug = productSlug(this.name, this._id.toString());
  }
  next();
});

// Virtual for minimum price
productSchema.virtual('minPrice').get(function () {
  if (!this.sizes || this.sizes.length === 0) return 0;
  return Math.min(...this.sizes.map((s) => s.price));
});

const Product = mongoose.model('Product', productSchema);
export default Product;
