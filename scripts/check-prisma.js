const { PrismaClient } = require('../src/generated/prisma/client');
const p = new PrismaClient();
console.log('Has depositRequest:', 'depositRequest' in p);
p.$disconnect();
