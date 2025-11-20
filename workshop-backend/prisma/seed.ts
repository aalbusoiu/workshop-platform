import { PrismaClient, UserRole, SessionStatus, RoundStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';

const prisma = new PrismaClient();

const DEFAULT_USER_PASSWORD = '1234';

// Universal fake JWT used for all seeded participants (unhashed/plain)
const UNIVERSAL_FAKE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzaWQiOjExMywicGlkIjozMTcsImV4cCI6MTc2Mjc0MzA4OCwiaWF0IjoxNzYyNDU1MDg4fQ.8uhF99Gfn5zrRvqx5g3So8_yJPL8jd9meAc-rZ8_Osk';

type ParticipantName = 'Alice' | 'Bob' | 'Carol' | 'Dave' | 'Eve' | 'Frank' | 'Grace' | 'Heidi' | 'Ivan';
type BmcPayloadsByParticipant = Record<'Alice' | 'Bob' | 'Carol' | 'Dave' | 'Eve', string>;

/**
 * Clear, scenario-aligned BMC payloads
 */
const BMC_PAYLOADS_ONBOARDING_USABILITY: BmcPayloadsByParticipant = {
  Alice: `Value Propositions: Instant setup in under 2 minutes
Customer Segments: Mid-market product teams
Channels: Self-serve web onboarding
Customer Relationships: Dedicated CSM for top tiers
Revenue Streams: Per-seat subscription
Key Resources: Secure cloud infrastructure
Key Activities: Continuous model training
Key Partnerships: Cloud provider alliance
Cost Structure: Cloud compute and storage`,
  Bob: `Value Propositions: AI-assisted decision guidance
Customer Segments: University research labs
Channels: Partner marketplaces
Customer Relationships: Community forum with experts
Revenue Streams: Usage-based overage
Key Resources: Machine learning models
Key Activities: Customer-driven roadmap
Key Partnerships: Security compliance auditors
Cost Structure: Security and compliance`,
  Carol: `Value Propositions: Privacy-by-design analytics
Customer Segments: Early-stage startups
Channels: Targeted email campaigns
Customer Relationships: In-app concierge onboarding
Revenue Streams: Professional services
Key Resources: Data processing pipeline
Key Activities: Compliance audits
Key Partnerships: Implementation partners
Cost Structure: R&D for AI features`,
  Dave: `Value Propositions: 99.99% uptime SLA
Customer Segments: SMB service providers
Channels: Developer advocacy events
Customer Relationships: Quarterly roadmap reviews
Revenue Streams: Marketplace revenue share
Key Resources: Customer success playbooks
Key Activities: SRE on-call rotations
Key Partnerships: University research consortium
Cost Structure: Customer support operations`,
  Eve: `Value Propositions: Automated benchmarking
Customer Segments: Enterprise analytics teams
Channels: Solutions partners
Customer Relationships: Dedicated TAM support
Revenue Streams: Tiered subscription
Key Resources: Observability platform
Key Activities: Performance benchmarking
Key Partnerships: Cloud marketplace alliance
Cost Structure: Platform operations`,
};

const BMC_PAYLOADS_PRICING_SENSITIVITY: BmcPayloadsByParticipant = {
  Alice: `Value Propositions: One-click migration
Customer Segments: Data engineering teams
Channels: Direct sales outreach
Customer Relationships: Slack support channel
Revenue Streams: Annual prepay discounts
Key Resources: Data connectors library
Key Activities: Connector maintenance
Key Partnerships: ETL vendors
Cost Structure: Connector certification`,
  Bob: `Value Propositions: Real-time alerts
Customer Segments: Ops teams
Channels: Webinars
Customer Relationships: Quarterly business reviews
Revenue Streams: Alerting add-on
Key Resources: Stream processing engine
Key Activities: Rule authoring
Key Partnerships: Incident response tooling
Cost Structure: Streaming infra`,
  Carol: `Value Propositions: Visual pipeline builder
Customer Segments: Citizen developers
Channels: Community marketplace
Customer Relationships: Community champions
Revenue Streams: Template marketplace fee
Key Resources: Template registry
Key Activities: Template curation
Key Partnerships: Creator ecosystem
Cost Structure: Curation ops`,
  Dave: `Value Propositions: Federated governance
Customer Segments: Platform teams
Channels: Field solution architects
Customer Relationships: Executive briefings
Revenue Streams: Enterprise support
Key Resources: Policy engine
Key Activities: Policy updates
Key Partnerships: Compliance partners
Cost Structure: Assurance audits`,
  Eve: `Value Propositions: Cross-cloud mobility
Customer Segments: Multi-cloud teams
Channels: Cloud partner portals
Customer Relationships: Architecture workshops
Revenue Streams: Migration services
Key Resources: Orchestration layer
Key Activities: Migration playbooks
Key Partnerships: Cloud providers
Cost Structure: Cross-cloud egress`,
};

async function createUser(
  email: string,
  role: UserRole,
  opts: { disabled?: boolean; customPassword?: string } = {},
) {
  const passwordToUse = opts.customPassword ?? DEFAULT_USER_PASSWORD;

  const passwordHash = await bcrypt.hash(passwordToUse, 10);

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      isDisabled: opts.disabled ?? false,
    },
  });
}

async function hashTokenBcrypt(token: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(token, saltRounds);
}

async function createParticipantWithToken(
  sessionId: number,
  displayName: string,
  colorHex: string,
) {
  const participant = await prisma.participant.create({
    data: { sessionId, displayName, colorHex },
  });

  const now = new Date();
  const expiresMs = 80 * 60 * 60 * 1000; // 80 hours
  const expiresAt = new Date(now.getTime() + expiresMs);

  // Always use the universal fake JWT for every participant
  const plainToken = UNIVERSAL_FAKE_JWT;

  // Hash before storing in DB
  const tokenHash = await hashTokenBcrypt(plainToken);

  await prisma.sessionToken.create({
    data: {
      participantId: participant.id,
      tokenHash,
      issuedAt: now,
      expiresAt,
      revokedAt: null,
    },
  });

  return { participant, plainToken, expiresAt };
}

async function createBmcProfileForParticipant(
  sessionId: number,
  participantId: number,
  payload: string,
) {
  return prisma.bmcProfile.create({
    data: {
      sessionId,
      participantId,
      payload,
    },
  });
}

async function createScenarioIfMissing(
  title: string,
  description: string,
  payload?: object,
) {
  const existing = await prisma.scenario.findFirst({ where: { title } });
  if (existing) return existing;
  return prisma.scenario.create({
    data: {
      title,
      description,
      payload: payload ?? {},
    },
  });
}

async function createPlannedRoundForSession(
  sessionId: number,
  roundNumber: number,
  scenarioId: number,
) {
  return prisma.round.upsert({
    where: { sessionId_roundNumber: { sessionId, roundNumber } },
    update: { scenarioId, status: RoundStatus.PLANNED },
    create: { sessionId, scenarioId, roundNumber, status: RoundStatus.PLANNED },
  });
}

type ParticipantSpec = { name: ParticipantName; color: string };

const DEFAULT_PARTICIPANT_SPECS: ParticipantSpec[] = [
  { name: 'Alice', color: '#FF5733' },
  { name: 'Bob', color: '#33C1FF' },
  { name: 'Carol', color: '#2ECC71' },
  { name: 'Dave', color: '#F1C40F' },
  { name: 'Eve', color: '#8E44AD' },
  { name: 'Frank', color: '#16A085' },
  { name: 'Grace', color: '#D35400' },
  { name: 'Heidi', color: '#7F8C8D' },
  { name: 'Ivan', color: '#C0392B' },
];

async function seedWorkshopSessionWithParticipants(options: {
  code: string;
  status: SessionStatus;
  ownerUserId: number;
  participantCount: number;
  bmcPayloads?: Partial<Record<ParticipantName, string>>;
}) {
  const {
    code,
    status,
    ownerUserId,
    participantCount,
    bmcPayloads = {},
  } = options;

  // 1) Create the session
  const session = await prisma.workshopSession.create({
    data: {
      code,
      status,
      createdById: ownerUserId,
    },
  });

  const actualCount = participantCount;
  const usedSpecs = DEFAULT_PARTICIPANT_SPECS.slice(0, actualCount);

  const participantTokens: Array<{ participantName: ParticipantName; token: string }> = [];

  for (const spec of usedSpecs) {
    const { participant, plainToken } = await createParticipantWithToken(
      session.id,
      spec.name,
      spec.color,
    );

    const payloadString =
      bmcPayloads[spec.name] ??
      BMC_PAYLOADS_ONBOARDING_USABILITY[spec.name as keyof BmcPayloadsByParticipant] ??
      '';

    await createBmcProfileForParticipant(session.id, participant.id, payloadString);

    participantTokens.push({ participantName: spec.name, token: plainToken });
  }

  return { session, participantTokens };
}

async function main() {
  await prisma.sessionToken.deleteMany({});
  await prisma.bmcProfile.deleteMany({});
  await prisma.participant.deleteMany({});
  await prisma.round.deleteMany({});
  await prisma.workshopSession.deleteMany({});
  await prisma.scenario.deleteMany({});
  await prisma.user.deleteMany({});

  const defaultUser = await createUser('john.doe@example.com', UserRole.MODERATOR, {
    customPassword: 'SecurePassword123!?',
  });

  const admin = await createUser('admin@example.com', UserRole.ADMIN, {
    customPassword: 'SecurePassword123!?',
  });

  const researcher = await createUser('researcher@example.com', UserRole.RESEARCHER, {
    customPassword: 'SecurePassword123!?',
  });

  const moderatorActive = await createUser(
    'moderator.active@example.com',
    UserRole.MODERATOR,
    { customPassword: 'SecurePassword123!?' },
  );

  const moderatorDisabled = await createUser(
    'moderator.disabled@example.com',
    UserRole.MODERATOR,
    { disabled: true, customPassword: 'SecurePassword123!?' },
  );

  const scenarioUsability = await createScenarioIfMissing(
    'Usability Pilot',
    'Validate onboarding flow usability with a small cohort.',
    { targetMetric: 'activationRate', threshold: 0.6 },
  );
  const scenarioPricing = await createScenarioIfMissing(
    'Pricing Sensitivity Test',
    'Explore willingness to pay across segments.',
    { method: 'vanWestendorp', sampleSize: 50 },
  );

  const allTokens: Array<{ sessionCode: string; participantName: string; token: string }> = [];

  const sessionsToSeed: Array<{
    code: string;
    status: SessionStatus;
    ownerId: number;
    count: number;
    payloads?: Partial<Record<ParticipantName, string>>;
  }> = [
    // LOBBY (4)
    { code: 'AB4C7', status: SessionStatus.LOBBY,     ownerId: admin.id,           count: 0, payloads: BMC_PAYLOADS_ONBOARDING_USABILITY },
    { code: 'ZX9Q2', status: SessionStatus.LOBBY,     ownerId: admin.id,           count: 1, payloads: BMC_PAYLOADS_PRICING_SENSITIVITY },
    { code: 'MB2H6', status: SessionStatus.LOBBY,     ownerId: admin.id,           count: 2, payloads: BMC_PAYLOADS_ONBOARDING_USABILITY },
    { code: 'DF7N6', status: SessionStatus.LOBBY,     ownerId: moderatorActive.id, count: 3, payloads: BMC_PAYLOADS_ONBOARDING_USABILITY },
    { code: 'QT6V1', status: SessionStatus.LOBBY,     ownerId: moderatorDisabled.id, count: 4, payloads: BMC_PAYLOADS_PRICING_SENSITIVITY },
    { code: 'KT5Z3', status: SessionStatus.LOBBY,     ownerId: moderatorDisabled.id, count: 5, payloads: BMC_PAYLOADS_PRICING_SENSITIVITY },

    // RUNNING
    { code: 'QP0L8', status: SessionStatus.RUNNING,   ownerId: moderatorActive.id, count: 0, payloads: BMC_PAYLOADS_ONBOARDING_USABILITY },
    { code: 'HS1D4', status: SessionStatus.RUNNING,   ownerId: researcher.id,      count: 1, payloads: BMC_PAYLOADS_PRICING_SENSITIVITY },
    { code: 'LM1T8', status: SessionStatus.RUNNING,   ownerId: moderatorActive.id, count: 2, payloads: BMC_PAYLOADS_ONBOARDING_USABILITY },
    { code: 'PR5K3', status: SessionStatus.RUNNING,   ownerId: moderatorActive.id, count: 5, payloads: BMC_PAYLOADS_PRICING_SENSITIVITY },
    { code: 'RW3X5', status: SessionStatus.RUNNING,   ownerId: researcher.id,      count: 4, payloads: BMC_PAYLOADS_ONBOARDING_USABILITY },
    { code: 'NY5J8', status: SessionStatus.RUNNING,   ownerId: moderatorActive.id, count: 3, payloads: BMC_PAYLOADS_PRICING_SENSITIVITY },

    // ENDED
    { code: 'GH2R9', status: SessionStatus.ENDED,     ownerId: moderatorActive.id, count: 0, payloads: BMC_PAYLOADS_PRICING_SENSITIVITY },
    { code: 'VS4L2', status: SessionStatus.ENDED,     ownerId: moderatorActive.id, count: 1, payloads: BMC_PAYLOADS_ONBOARDING_USABILITY },
    { code: 'VA2K7', status: SessionStatus.ENDED,     ownerId: moderatorActive.id, count: 2, payloads: BMC_PAYLOADS_ONBOARDING_USABILITY },
    { code: 'CE3R1', status: SessionStatus.ENDED,     ownerId: moderatorActive.id, count: 3, payloads: BMC_PAYLOADS_PRICING_SENSITIVITY },
    { code: 'WL4N5', status: SessionStatus.ENDED,     ownerId: moderatorActive.id, count: 4, payloads: BMC_PAYLOADS_ONBOARDING_USABILITY },
    { code: 'BY5T2', status: SessionStatus.ENDED,     ownerId: moderatorActive.id, count: 5, payloads: BMC_PAYLOADS_PRICING_SENSITIVITY },

    // ABANDONED
    { code: 'JK8M4', status: SessionStatus.ABANDONED, ownerId: moderatorActive.id, count: 2, payloads: BMC_PAYLOADS_ONBOARDING_USABILITY },
    { code: 'TC9P7', status: SessionStatus.ABANDONED,   ownerId: moderatorActive.id, count: 5, payloads: BMC_PAYLOADS_PRICING_SENSITIVITY },
    { code: 'UX0M9', status: SessionStatus.ABANDONED, ownerId: moderatorActive.id, count: 0, payloads: BMC_PAYLOADS_ONBOARDING_USABILITY },
    { code: 'AG1P6', status: SessionStatus.ABANDONED, ownerId: moderatorActive.id, count: 1, payloads: BMC_PAYLOADS_PRICING_SENSITIVITY },
    { code: 'NR3Q8', status: SessionStatus.ABANDONED, ownerId: moderatorActive.id, count: 3, payloads: BMC_PAYLOADS_ONBOARDING_USABILITY },
    { code: 'JF4V0', status: SessionStatus.ABANDONED, ownerId: moderatorActive.id, count: 4, payloads: BMC_PAYLOADS_PRICING_SENSITIVITY },
  ];

  for (const cfg of sessionsToSeed) {
    const result = await seedWorkshopSessionWithParticipants({
      code: cfg.code,
      status: cfg.status,
      ownerUserId: cfg.ownerId,
      participantCount: cfg.count,
      bmcPayloads: cfg.payloads,
    });

    allTokens.push(
      ...result.participantTokens.map((t) => ({
        sessionCode: cfg.code,
        participantName: t.participantName,
        token: t.token,
      })),
    );
  }

  await createPlannedRoundForSession(
    (await prisma.workshopSession.findFirstOrThrow({ where: { code: 'NY5J8' } })).id,
    1,
    scenarioUsability.id,
  );
  await createPlannedRoundForSession(
    (await prisma.workshopSession.findFirstOrThrow({ where: { code: 'VS4L2' } })).id,
    1,
    scenarioPricing.id,
  );

  console.log(`\n Unhashed tokens written to seed_tokens.json (${allTokens.length} entries)\n`);

  console.log('Seeding complete');
  console.log('Participant test tokens (plain):');
  for (const t of allTokens) {
    console.log(`session=${t.sessionCode} | participant=${t.participantName} | token=${t.token}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 