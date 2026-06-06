import { getConnections, insertUser, PgTestClient } from 'insforge-test';

let db: PgTestClient;
let pg: PgTestClient;
let teardown: () => Promise<void>;

let user1: any;
let user2: any;
let user3: any;

const users = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'tutorial1@example.com',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    email: 'tutorial2@example.com',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    email: 'tutorial3@example.com',
  },
];

beforeAll(async () => {
  ({ pg, db, teardown } = await getConnections());
  user1 = await insertUser(pg, users[0].email, users[0].id);
  user2 = await insertUser(pg, users[1].email, users[1].id);
  user3 = await insertUser(pg, users[2].email, users[2].id);
});

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await db.beforeEach();
});

afterEach(async () => {
  await db.afterEach();
});

describe('tutorial: basic rls crud operations', () => {
  it('should allow user to create their own pet record', async () => {
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id,
    });

    const pet = await db.one(
      `INSERT INTO rls_test.pets (name, breed, user_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, breed, user_id`,
      ['Fido', 'Labrador', user1.id]
    );

    expect(pet.name).toBe('Fido');
    expect(pet.breed).toBe('Labrador');
    expect(pet.user_id).toBe(user1.id);
  });

  it('should prevent user1 from updating user2 record', async () => {
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user2.id,
    });

    const pet = await db.one(
      `INSERT INTO rls_test.pets (name, breed, user_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, breed, user_id`,
      ['Buddy', 'Golden Retriever', user2.id]
    );

    expect(pet.user_id).toBe(user2.id);

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id,
    });

    await expect(
      db.one(
        `UPDATE rls_test.pets
         SET name = $1
         WHERE id = $2
         RETURNING id, name, breed, user_id`,
        ['Hacked Name', pet.id]
      )
    ).rejects.toThrow();
  });

  it('should allow users to see only their own data in list queries', async () => {
    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id,
    });

    await db.one(
      `INSERT INTO rls_test.pets (name, breed, user_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['Fido', 'Labrador', user1.id]
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user2.id,
    });

    await db.one(
      `INSERT INTO rls_test.pets (name, breed, user_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['Buddy', 'Golden Retriever', user2.id]
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user3.id,
    });

    await db.one(
      `INSERT INTO rls_test.pets (name, breed, user_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['Rex', 'German Shepherd', user3.id]
    );

    db.setContext({
      role: 'authenticated',
      'request.jwt.claim.sub': user1.id,
    });

    const allPets = await db.many(
      `SELECT id, name, breed, user_id FROM rls_test.pets ORDER BY name`
    );

    expect(allPets.length).toBe(1);
    expect(allPets[0].user_id).toBe(user1.id);
    expect(allPets[0].name).toBe('Fido');
    expect(allPets[0].breed).toBe('Labrador');
  });
});
