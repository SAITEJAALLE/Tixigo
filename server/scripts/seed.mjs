import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1) Seed basic users (passwordHash left null for dev; set via UI or Prisma Studio)
  const owner = await prisma.user.upsert({
    where: { email: 'owner@trixigo.local' },
    update: {},
    create: {
      email: 'owner@trixigo.local',
      name: 'Trixigo Owner',
      role: 'OWNER',
    },
  });

  const organizerUser = await prisma.user.upsert({
    where: { email: 'org@trixigo.local' },
    update: {},
    create: {
      email: 'org@trixigo.local',
      name: 'Demo Organizer',
      role: 'ORGANIZER',
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'alice@demo.local' },
    update: {},
    create: {
      email: 'alice@demo.local',
      name: 'Alice Demo',
      role: 'CUSTOMER',
    },
  });

  // 2) Organizer profile (now includes feePaid per our schema change)
  await prisma.organizerProfile.upsert({
    where: { userId: organizerUser.id },
    update: {
      approved: true,
      feePaid: true,
      displayName: 'Demo Org',
    },
    create: {
      userId: organizerUser.id,
      displayName: 'Demo Org',
      approved: true,
      feePaid: true,
    },
  });

  // 3) Demo event (note: photos is required in your schema; provide at least an empty array or a sample image)
  const event = await prisma.event.create({
    data: {
      organizerId: organizerUser.id,
      title: 'Demo Concert',
      description: 'A great night of music.',
      photos: ['https://picsum.photos/seed/trixigo/1200/600'],
      category: 'Concert',
      location: 'O2 Arena, London',
      minAge: 12,
      isActive: true,
      startDate: new Date('2025-09-26T17:37:22.018Z'),
      endDate: new Date('2025-10-02T17:37:22.018Z'),

      ticketTypes: {
        create: [
          { name: 'Standard', priceCents: 2000, currency: 'GBP' },
          { name: 'VIP', priceCents: 5000, currency: 'GBP', includesDrink: true },
        ],
      },

      //  ShowTime model expects a single "dateTime"
      showTimes: {
        create: [
          { dateTime: new Date('2025-09-27T18:00:00.000Z'), capacity: 200 },
          { dateTime: new Date('2025-09-28T20:00:00.000Z'), capacity: 250 },
        ],
      },
    },
  });

  console.log('Seed complete ✅', { owner: owner.email, organizer: organizerUser.email, customer: customer.email, event: event.title });
}

main()
  .catch((e) => {
    console.error('Seed failed ❌', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
