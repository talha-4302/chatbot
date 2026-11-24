import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // ponytail: open CORS for local dev, restrict origin before deploying
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Chatbot API').setVersion('0.1.0').build());
  SwaggerModule.setup('docs', app, doc); // UI at /docs, JSON at /docs-json
  await app.listen(Number(process.env.PORT ?? 3000));
}
bootstrap();
