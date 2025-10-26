import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { PrismaClient } from '@prisma/client';

import authRouter from './routes/auth.js';
import eventRouter from './routes/events.js';
import orderRouter from './routes/orders.js';
import staffRouter from './routes/staff.js';
import adminRouter from './routes/admin.js';
import extraRoutes from './routes/extraRoutes.js';
import { organizersRouter, adminOrganizersRouter } from './routes/organizers.js';

const app = express();
export const prisma = new PrismaClient();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

app.get('/health', (_, res) => res.json({ ok: true }));

// ---- Everything under /api (matches VITE_API_BASE) ----
app.use('/api/admin/organizers', adminOrganizersRouter);
app.use('/api/auth', authRouter);
app.use('/api/events', eventRouter);
app.use('/api/orders', orderRouter);
app.use('/api/staff', staffRouter);


app.use('/api/admin', adminRouter);
app.use('/api/organizers', organizersRouter);

// New discovery, refunds, reviews etc (e.g. /api/v1/events)
app.use('/api', extraRoutes);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
