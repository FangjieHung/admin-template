import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageRepository } from './local-storage-repository';
import {
  LazySeedLocalStorageRepository,
  StorageResetEvent,
} from './lazy-seed-local-storage-repository';

interface Item {
  id: string;
  name: string;
}
const KEY = 'test.lazy';
const seedItems = (): Item[] => [
  { id: 's1', name: 'seeded' },
  { id: 's2', name: 'seeded 2' },
];

function countingSeed() {
  const load = vi.fn(async () => seedItems());
  return { seed: load, load };
}

describe('LazySeedLocalStorageRepository', () => {
  beforeEach(() => localStorage.clear());

  it('inspect 分辨正常、沒有資料、內容損壞', () => {
    const repo = new LazySeedLocalStorageRepository<Item>(KEY, countingSeed().seed);
    expect(repo.inspect()).toBe('missing');
    localStorage.setItem(KEY, '{not json');
    expect(repo.inspect()).toBe('corrupt');
    localStorage.setItem(KEY, '{"a":1}');
    expect(repo.inspect()).toBe('corrupt');
    localStorage.setItem(KEY, '[]');
    expect(repo.inspect()).toBe('ok');
  });

  it('ensureReady：資料正常時不載入示範資料', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 'a', name: 'A' }]));
    const { seed, load } = countingSeed();
    const repo = new LazySeedLocalStorageRepository<Item>(KEY, seed);
    expect(await repo.ensureReady()).toBe('ok');
    expect(load).not.toHaveBeenCalled();
    expect(repo.getAll()).toEqual([{ id: 'a', name: 'A' }]);
  });

  it('ensureReady：沒有資料時載入並寫入示範資料，之後同步讀得到', async () => {
    const { seed, load } = countingSeed();
    const onReset = vi.fn();
    const repo = new LazySeedLocalStorageRepository<Item>(KEY, seed, onReset);
    expect(await repo.ensureReady()).toBe('seeded');
    expect(load).toHaveBeenCalledTimes(1);
    expect(repo.getAll()).toEqual(seedItems());
    expect(onReset).not.toHaveBeenCalled();
  });

  it('ensureReady：內容損壞時重設並回報 reset（提示交給呼叫端）', async () => {
    localStorage.setItem(KEY, '{not json');
    const onReset = vi.fn();
    const repo = new LazySeedLocalStorageRepository<Item>(KEY, countingSeed().seed, onReset);
    expect(await repo.ensureReady()).toBe('reset');
    expect(repo.getAll()).toEqual(seedItems());
    expect(onReset).not.toHaveBeenCalled();
  });

  it('使用中損壞：讀取先回空清單，只重設一次，重設後資料恢復並通知', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 'a', name: 'A' }]));
    const { seed, load } = countingSeed();
    const events: StorageResetEvent[] = [];
    const repo = new LazySeedLocalStorageRepository<Item>(KEY, seed, (e) => events.push(e));
    expect(repo.getAll()).toHaveLength(1);

    localStorage.setItem(KEY, '{broken');
    expect(repo.getAll()).toEqual([]);
    expect(repo.getAll()).toEqual([]);
    expect(repo.getById('s1')).toBeUndefined();
    expect(repo.resetting).toBe(true);

    await repo.whenSettled();
    expect(load).toHaveBeenCalledTimes(1);
    expect(events).toEqual([{ key: KEY, corrupt: true }]);
    expect(repo.getAll()).toEqual(seedItems());
    expect(repo.resetting).toBe(false);
  });

  it('使用中損壞：重設期間的寫入在示範資料寫回後依序套用', async () => {
    localStorage.setItem(KEY, '{broken');
    const repo = new LazySeedLocalStorageRepository<Item>(KEY, countingSeed().seed);
    repo.create({ id: 'n1', name: 'new' });
    repo.update('s1', { name: 'patched' });
    repo.update('ghost', { name: 'ignored' });
    repo.remove('s2');
    await repo.whenSettled();
    expect(repo.getAll()).toEqual([
      { id: 's1', name: 'patched' },
      { id: 'n1', name: 'new' },
    ]);
  });

  it('使用中資料被清空：非同步灌入示範資料，通知但標記為非損壞', async () => {
    const events: StorageResetEvent[] = [];
    const repo = new LazySeedLocalStorageRepository<Item>(KEY, countingSeed().seed, (e) =>
      events.push(e),
    );
    expect(repo.getAll()).toEqual([]);
    await repo.whenSettled();
    expect(events).toEqual([{ key: KEY, corrupt: false }]);
    expect(repo.getAll()).toEqual(seedItems());
  });

  it('示範資料載入失敗時放棄這次重設，下次讀取再試', async () => {
    localStorage.setItem(KEY, '{broken');
    const load = vi
      .fn<() => Promise<Item[]>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(seedItems());
    const onReset = vi.fn();
    const repo = new LazySeedLocalStorageRepository<Item>(KEY, load, onReset);
    expect(repo.getAll()).toEqual([]);
    await repo.whenSettled();
    expect(onReset).not.toHaveBeenCalled();
    expect(repo.resetting).toBe(false);
    expect(repo.getAll()).toEqual([]);
    await repo.whenSettled();
    expect(load).toHaveBeenCalledTimes(2);
    expect(repo.getAll()).toEqual(seedItems());
  });

  it('原本的 LocalStorageRepository（booking／affiliate 用）維持同步重設', () => {
    localStorage.setItem(KEY, '{broken');
    const onReset = vi.fn();
    const repo = new LocalStorageRepository<Item>(KEY, seedItems, onReset);
    expect(repo.getAll()).toEqual(seedItems());
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
