import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './config/db.js';
import userModel from './models/userModel.js';
import bcrypt from 'bcrypt';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

const seedAdmin = async () => {
  try {
    // Connect to database
    await connectDB();

    const username = 'admin';
    const password = '123456';
    const role = 'admin';

    // Check if admin already exists
    const existingAdmin = await userModel.findOne({ username, role });
    if (existingAdmin) {
      logger.info('Admin user already exists');
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin user
    const newAdmin = new userModel({
      username,
      password: hashedPassword,
      role,
      statusMain: 'online'
    });

    await newAdmin.save();

    logger.info(`Admin user created: ${newAdmin.username} (${newAdmin.role})`);
    console.log(`Admin user created successfully: ${newAdmin.username}`);

    process.exit(0);
  } catch (error) {
    logger.error('Error seeding admin user:', error);
    console.error('Error seeding admin user:', error.message);
    process.exit(1);
  }
};

seedAdmin();