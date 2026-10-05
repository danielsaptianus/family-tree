import { ValidationPipe, VersioningType, ClassSerializerInterceptor } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Get configurations
  const swaggerEnabled = configService.get<boolean>('swagger.enabled');
  const corsOrigin = configService.get<string>('app.corsOrigin');
  const swaggerPath = configService.get<string>('swagger.path');
  const apiPrefix = configService.get<string>('app.apiPrefix');
  const port = configService.get<number>('app.port');

  // Enable CORS
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Class serializer for excluding fields (like password)
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Swagger Documentation
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Family Tree API')
      .setDescription(
        'Backend Family Tree Engine berbasis NestJS, PostgreSQL (btree_gist & Recursive CTE), dan D3.js Tree Generator siap saji untuk format Hierarchy & Graph.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Masukkan JWT token access',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Authentication', 'Endpoint otentikasi login, register, dan profil user')
      .addTag('Users', 'Manajemen data user dan role admin')
      .addTag('Trees', 'Manajemen Pohon Silsilah Keluarga & Visualisasi D3 (FR-01 s.d. FR-03, FR-13 s.d. FR-16)')
      .addTag('Persons', 'Manajemen Individu / Person dalam Tree (FR-04 s.d. FR-07)')
      .addTag('Relationships', 'Manajemen Relasi Parent-Child & Partnerships (FR-08 s.d. FR-11)')
      .addTag('Health', 'Health check dan monitoring status koneksi database')
      .build();

    const document = SwaggerModule.createDocument(app, config);

    // Buka Swagger di /docs (NFR-10) dan /api/docs
    SwaggerModule.setup(swaggerPath, app, document, {
      useGlobalPrefix: false,
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    SwaggerModule.setup(`${apiPrefix}/${swaggerPath}`, app, document, {
      useGlobalPrefix: false,
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  await app.listen(port);

  console.log(`\n🚀 Application is running on: http://localhost:${port}/`);
  console.log(`🌍 Environment: ${configService.get<string>('app.env')}\n`);
  if (swaggerEnabled) {
    console.log(`📚 Swagger Documentaion on : http://localhost:${port}/api/${swaggerPath}`);
  }
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🏓 Ping endpoint: http://localhost:${port}/ping\n`);
}

bootstrap();
