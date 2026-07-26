import { model, Schema } from "mongoose";

const expenseSchema = new Schema(
  {
    category: {
      type: String,
      enum: ["ADVERTISING", "SHIPPING", "RENT", "SALARY", "REPAIRS", "OTHER"],
      required: true,
    },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    notes: String,
  },
  { timestamps: true },
);

const debtInstallmentSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    notes: String,
  },
  { _id: true },
);

const debtSchema = new Schema(
  {
    type: { type: String, enum: ["BORROWED", "LENT"], required: true },
    personName: { type: String, required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    remainingAmount: { type: Number },
    isPaid: { type: Boolean, default: false },
    dueDate: Date,
    notes: String,
    installments: { type: [debtInstallmentSchema], default: [] },
  },
  { timestamps: true },
);

const stockPurchaseSchema = new Schema(
  {
    description: { type: String, required: true },
    supplier: String,
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    notes: String,
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    fundedByRevenue: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const storeSaleSchema = new Schema(
  {
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    salePrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    notes: String,
    date: { type: Date, default: Date.now },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
  },
  { timestamps: true },
);

export const ExpenseModel = model("Expense", expenseSchema);
export const DebtModel = model("Debt", debtSchema);
export const StockPurchaseModel = model("StockPurchase", stockPurchaseSchema);
export const StoreSaleModel = model("StoreSale", storeSaleSchema);
