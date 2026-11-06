import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testEmail = `e2e-test-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (user) {
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  it('rejects a protected route with no token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('registers, authenticates /me, refreshes, then logout revokes the session', async () => {
    const agent = request.agent(app.getHttpServer());

    const registerRes = await agent
      .post('/api/v1/auth/register')
      .send({ fullName: 'E2E Test User', email: testEmail, password: 'SuperSecret123' })
      .expect(201);

    expect(registerRes.body.user.email).toBe(testEmail);
    expect(registerRes.body.user.passwordHash).toBeUndefined();
    expect(registerRes.body.accessToken).toEqual(expect.any(String));
    const setCookie = registerRes.headers['set-cookie'];
    expect(setCookie?.[0]).toMatch(/refresh_token=/);

    const accessToken = registerRes.body.accessToken as string;
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(meRes.body.email).toBe(testEmail);
    expect(meRes.body.role).toBe('APPLICANT');

    const refreshRes = await agent.post('/api/v1/auth/refresh').expect(201);
    expect(refreshRes.body.accessToken).toEqual(expect.any(String));
    expect(refreshRes.body.accessToken).not.toBe(accessToken);

    await agent.post('/api/v1/auth/logout').expect(201);

    // The rotated-then-logged-out refresh token must no longer work.
    await agent.post('/api/v1/auth/refresh').expect(401);
  });

  it('rejects login with the wrong password without revealing which field was wrong', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: 'wrong-password' })
      .expect(401);
    expect(res.body.message).toBe('Invalid email or password');
  });
});
