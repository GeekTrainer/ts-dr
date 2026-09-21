import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getGames,
} from './games';

/** Database identifiers used by the filtering test catalog. */
interface FilterCatalogIds {
    /** Identifier for the strategy category fixture. */
    strategyId: number;
    /** Identifier for the puzzle category fixture. */
    puzzleId: number;
    /** Identifier for the first publisher fixture. */
    publisherOneId: number;
    /** Identifier for the second publisher fixture. */
    publisherTwoId: number;
}

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

/** Seeds a catalog spanning two categories and two publishers. */
async function seedFilterCatalog(db: Database): Promise<FilterCatalogIds> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'Strategy games' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'Puzzle games' })
        .returning({ id: categories.id });
    const [publisherOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'First publisher' })
        .returning({ id: publishers.id });
    const [publisherTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'Second publisher' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Zulu Strategy',
            description: 'Strategy from publisher one',
            starRating: 4.1,
            categoryId: strategy.id,
            publisherId: publisherOne.id,
        },
        {
            title: 'Alpha Strategy',
            description: 'Strategy from publisher two',
            starRating: 4.2,
            categoryId: strategy.id,
            publisherId: publisherTwo.id,
        },
        {
            title: 'Beta Puzzle',
            description: 'Puzzle from publisher one',
            starRating: 4.3,
            categoryId: puzzle.id,
            publisherId: publisherOne.id,
        },
        {
            title: 'Gamma Puzzle',
            description: 'Puzzle from publisher two',
            starRating: 4.4,
            categoryId: puzzle.id,
            publisherId: publisherTwo.id,
        },
    ]);

    return {
        strategyId: strategy.id,
        puzzleId: puzzle.id,
        publisherOneId: publisherOne.id,
        publisherTwoId: publisherTwo.id,
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('filters games by one category', async () => {
        const ids = await seedFilterCatalog(db);

        const filtered = await getGames(db, { categoryIds: [ids.strategyId] });

        expect(filtered.map((game) => game.title)).toEqual(['Alpha Strategy', 'Zulu Strategy']);
    });

    it('filters games by any of multiple categories', async () => {
        const ids = await seedFilterCatalog(db);

        const filtered = await getGames(db, {
            categoryIds: [ids.strategyId, ids.puzzleId],
        });

        expect(filtered.map((game) => game.title)).toEqual([
            'Alpha Strategy',
            'Beta Puzzle',
            'Gamma Puzzle',
            'Zulu Strategy',
        ]);
    });

    it('filters games by publisher', async () => {
        const ids = await seedFilterCatalog(db);

        const filtered = await getGames(db, { publisherId: ids.publisherOneId });

        expect(filtered.map((game) => game.title)).toEqual(['Beta Puzzle', 'Zulu Strategy']);
    });

    it('combines category and publisher filters', async () => {
        const ids = await seedFilterCatalog(db);

        const filtered = await getGames(db, {
            categoryIds: [ids.puzzleId],
            publisherId: ids.publisherTwoId,
        });

        expect(filtered.map((game) => game.title)).toEqual(['Gamma Puzzle']);
    });

    it('treats an empty category list as no category restriction', async () => {
        const ids = await seedFilterCatalog(db);

        const filtered = await getGames(db, {
            categoryIds: [],
            publisherId: ids.publisherOneId,
        });

        expect(filtered.map((game) => game.title)).toEqual(['Beta Puzzle', 'Zulu Strategy']);
    });

    it('returns no games for unmatched filter ids', async () => {
        await seedFilterCatalog(db);

        expect(await getGames(db, { categoryIds: [99999] })).toEqual([]);
        expect(await getGames(db, { publisherId: 99999 })).toEqual([]);
    });

    it('returns every game for empty filters', async () => {
        await seedFilterCatalog(db);

        const filtered = await getGames(db, {});
        const all = await getAllGames(db);

        expect(filtered).toEqual(all);
    });
});
