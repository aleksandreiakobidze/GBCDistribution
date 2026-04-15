import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_person: z.string().min(1, 'Contact person is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  category: z.enum(['A', 'B', 'C']),
  credit_limit: z.number().min(0).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  assigned_sales_rep_id: z.number().optional(),
});

export const orderItemSchema = z.object({
  product_id: z.number(),
  quantity: z.number().min(1),
  unit_price: z.number().min(0),
  discount_percent: z.number().min(0).max(100).default(0),
});

export const createOrderSchema = z.object({
  customer_id: z.number({ error: 'Customer is required' }),
  warehouse_id: z.number({ error: 'Warehouse is required' }),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1, 'At least one product is required'),
});

export const paymentSchema = z.object({
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  method: z.enum(['cash', 'bank_transfer', 'check']),
  reference: z.string().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type CustomerFormData = z.infer<typeof customerSchema>;
export type CreateOrderFormData = z.infer<typeof createOrderSchema>;
export type PaymentFormData = z.infer<typeof paymentSchema>;
