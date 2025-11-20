import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configure CORS for production security
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Validate required environment variables for production
  if (isProduction && !process.env.FRONTEND_URL) {
    throw new Error('FRONTEND_URL must be set in production environment');
  }
  
  // Development origins - common ports and localhost variations
  const devOrigins = [
    'http://localhost:3000',    // Nuxt.js default
    'http://localhost:3001',    // Alternative port
    'http://localhost:5173',    // Vite default
    'http://127.0.0.1:3000',    // IPv4 localhost
    'http://127.0.0.1:3001',    
    // Add your specific dev URLs here as needed
  ];
  
  app.enableCors({
    origin: isProduction 
      ? process.env.FRONTEND_URL 
      : devOrigins, // Specific origins for proper cookie handling in dev
    credentials: true, // Allow cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Configure cookie parser
  app.use(cookieParser());

  // Global API prefix and versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Dynamic Business Modeling Game API')
    .setDescription('Welcome to our Workshop Platform API documentation. This interface provides comprehensive information about all available endpoints, including request/response formats, authentication requirements, and rate limits. You can test API calls directly in your browser, making it easier to integrate with the frontend or understand how the system works. We\'ve designed this to help our team work more efficiently throughout the project.')
    .setVersion('1.0.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      description: 'Enter JWT token (obtained from /auth/login)',
      in: 'header',
    })
    .addTag('Authentication v1', 'Complete user authentication system with secure token management. Supports invitation-based registration, JWT access tokens (15min validity), HttpOnly refresh tokens (8hr validity) with automatic rotation, and comprehensive session management including single/multi-device logout capabilities.')
    .addTag('Users Management v1', 'User management system for admins to list and update user roles. Includes role filtering, search capabilities, and secure role transitions with full audit logging.')
    .addTag('Invitations v1', 'User invitation management system for admins to invite new users with role-based access. Handles invitation creation, email delivery, token validation, and secure registration flow.')
    .addTag('Sessions v1', 'Workshop session management including session creation, participant management, real-time collaboration features, and session lifecycle control.')
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  doc.servers = [{ url: 'http://localhost:3000' }];
  SwaggerModule.setup('docs', app, doc, {
    jsonDocumentUrl: 'docs/json',
    yamlDocumentUrl: 'docs/yaml',
    customSiteTitle: 'Dynamic Business Modeling Game API',
    customfavIcon: '/favicon.ico',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
