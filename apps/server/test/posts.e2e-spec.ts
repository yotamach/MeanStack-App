import { createTestApp, PNG, registerAndLogin, TestApp } from './helpers';

describe('Posts API', () => {
  let t: TestApp;
  let owner: Awaited<ReturnType<typeof registerAndLogin>>;
  let other: Awaited<ReturnType<typeof registerAndLogin>>;

  beforeAll(async () => {
    t = await createTestApp();
    owner = await registerAndLogin(t);
    other = await registerAndLogin(t);
  });
  afterAll(() => t.close());

  const bearer = (u: { token: string }) => ({ Authorization: `Bearer ${u.token}` });
  const createPost = (title = 'Hello', user = owner) =>
    t
      .http()
      .post('/api/posts')
      .set(bearer(user))
      .field('title', title)
      .field('content', 'World')
      .attach('image', PNG, 'pic.png');

  describe('creating', () => {
    it('requires authentication', async () => {
      await t
        .http()
        .post('/api/posts')
        .field('title', 'abc')
        .field('content', 'c')
        .attach('image', PNG, 'p.png')
        .expect(401);
      await t.http().post('/api/posts').set('Authorization', 'Bearer undefined').expect(401);
    });

    it('stores the post and serves its image', async () => {
      const res = await createPost('First').expect(201);
      expect(res.body.post).toMatchObject({ title: 'First', content: 'World' });
      const url = new URL(res.body.post.imagePath);
      expect(url.pathname).toMatch(/^\/images\/pic-\d+\.png$/);
      const img = await t.http().get(url.pathname).expect(200);
      expect(img.headers['content-type']).toBe('image/png');
    });

    it('requires an image', async () => {
      const res = await t
        .http()
        .post('/api/posts')
        .set(bearer(owner))
        .field('title', 'abc')
        .field('content', 'c')
        .expect(400);
      expect(res.body.message).toBe('Image is required!');
    });

    it('rejects a file that is not really a PNG/JPEG, whatever its name or type', async () => {
      const res = await t
        .http()
        .post('/api/posts')
        .set(bearer(owner))
        .field('title', 'abc')
        .field('content', 'c')
        .attach('image', Buffer.from('<script>alert(1)</script>'), {
          filename: 'x.png',
          contentType: 'image/png',
        })
        .expect(400);
      expect(res.body.message).toBe('Invalid mime type');
    });

    it('rejects images over 5MB', async () => {
      const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
      await t
        .http()
        .post('/api/posts')
        .set(bearer(owner))
        .field('title', 'abc')
        .field('content', 'c')
        .attach('image', big, 'big.png')
        .expect(413);
    });

    it.each([
      ['a too-short title', { title: 'a', content: 'c' }],
      ['missing content', { title: 'abc' }],
    ])('rejects %s', async (_n, fields) => {
      let req = t.http().post('/api/posts').set(bearer(owner)).attach('image', PNG, 'p.png');
      for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
      await req.expect(400);
    });
  });

  describe('reading', () => {
    beforeAll(async () => {
      for (const n of [1, 2, 3]) await createPost(`Paged ${n}`);
    });

    it('lists newest first with the total count', async () => {
      const res = await t.http().get('/api/posts').expect(200);
      expect(res.body.maxPosts).toBeGreaterThanOrEqual(3);
      expect(res.body.posts[0]).toEqual({
        _id: expect.any(String),
        title: expect.any(String),
        content: 'World',
        imagePath: expect.stringContaining('/images/'),
        creator: owner.userId,
      });
      expect(res.body.posts[0].title).toBe('Paged 3');
    });

    it('paginates', async () => {
      const p1 = await t.http().get('/api/posts?pagesize=2&page=1').expect(200);
      const p2 = await t.http().get('/api/posts?pagesize=2&page=2').expect(200);
      expect(p1.body.posts).toHaveLength(2);
      expect(p2.body.posts.length).toBeGreaterThan(0);
      expect(p1.body.posts[0]._id).not.toBe(p2.body.posts[0]._id);
      expect(p1.body.maxPosts).toBe(p2.body.maxPosts);
    });

    it('caps the page size', async () => {
      const res = await t.http().get('/api/posts?pagesize=100000&page=1').expect(200);
      expect(res.body.posts.length).toBeLessThanOrEqual(100);
    });

    it('gets one post, 404s a missing one and 400s a malformed id', async () => {
      const created = await createPost('Single').expect(201);
      const got = await t.http().get(`/api/posts/${created.body.post.id}`).expect(200);
      expect(got.body.title).toBe('Single');
      await t.http().get('/api/posts/aaaaaaaaaaaaaaaaaaaaaaaa').expect(404);
      const bad = await t.http().get('/api/posts/not-an-id').expect(400);
      expect(bad.body.message).toBe('Invalid id!');
    });
  });

  describe('updating', () => {
    it('lets the owner edit without changing the image (JSON-ish multipart with imagePath)', async () => {
      const created = await createPost('Edit me').expect(201);
      const { id, imagePath } = created.body.post;
      await t
        .http()
        .put(`/api/posts/${id}`)
        .set(bearer(owner))
        .field('title', 'Edited')
        .field('content', 'World')
        .field('imagePath', imagePath)
        .expect(200);
      const got = await t.http().get(`/api/posts/${id}`).expect(200);
      expect(got.body).toMatchObject({ title: 'Edited', imagePath });
    });

    it('succeeds even when nothing changed (regression: used to answer 401)', async () => {
      const created = await createPost('Same').expect(201);
      const { id, imagePath } = created.body.post;
      await t
        .http()
        .put(`/api/posts/${id}`)
        .set(bearer(owner))
        .field('title', 'Same')
        .field('content', 'World')
        .field('imagePath', imagePath)
        .expect(200);
    });

    it('replaces the image when a new one is uploaded', async () => {
      const created = await createPost('New pic').expect(201);
      const { id, imagePath } = created.body.post;
      await t
        .http()
        .put(`/api/posts/${id}`)
        .set(bearer(owner))
        .field('title', 'New pic')
        .field('content', 'World')
        .attach('image', PNG, 'second.png')
        .expect(200);
      const got = await t.http().get(`/api/posts/${id}`).expect(200);
      expect(got.body.imagePath).not.toBe(imagePath);
      expect(got.body.imagePath).toMatch(/second-\d+\.png$/);
    });

    it("refuses to edit someone else's post", async () => {
      const created = await createPost('Mine').expect(201);
      const { id, imagePath } = created.body.post;
      const res = await t
        .http()
        .put(`/api/posts/${id}`)
        .set(bearer(other))
        .field('title', 'Hacked')
        .field('content', 'x')
        .field('imagePath', imagePath)
        .expect(401);
      expect(res.body.message).toBe('Not authorized!');
      expect((await t.http().get(`/api/posts/${id}`)).body.title).toBe('Mine');
    });
  });

  describe('deleting', () => {
    it("refuses to delete someone else's post, then lets the owner delete it", async () => {
      const created = await createPost('Delete me').expect(201);
      const { id } = created.body.post;
      await t.http().delete(`/api/posts/${id}`).set(bearer(other)).expect(401);
      await t.http().get(`/api/posts/${id}`).expect(200);
      await t.http().delete(`/api/posts/${id}`).set(bearer(owner)).expect(200); // regression: always answered 401
      await t.http().get(`/api/posts/${id}`).expect(404);
      await t.http().delete(`/api/posts/${id}`).set(bearer(owner)).expect(401);
    });

    it('requires authentication', async () => {
      const created = await createPost('Keep me').expect(201);
      await t.http().delete(`/api/posts/${created.body.post.id}`).expect(401);
    });
  });
});
