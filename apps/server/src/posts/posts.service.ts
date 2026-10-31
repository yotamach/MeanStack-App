import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Post as PostDto, PostsPage } from '@meanstack/shared';
import { detectImageExt } from '../storage/image-type';
import { StorageService } from '../storage/storage.service';
import { Post, PostDocument } from './post.schema';

const MAX_PAGE_SIZE = 100;

const toDto = (p: PostDocument): PostDto => ({
  _id: p.id,
  title: p.title,
  content: p.content,
  imagePath: p.imagePath,
  creator: p.creator.toString(),
});

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private readonly posts: Model<PostDocument>,
    private readonly storage: StorageService,
  ) {}

  private async storeImage(file: Express.Multer.File): Promise<string> {
    const ext = detectImageExt(file.buffer);
    if (!ext) {
      throw new BadRequestException('Invalid mime type');
    }
    return this.storage.save(file.buffer, file.originalname.replace(/\.[^.]*$/, ''), ext);
  }

  async create(
    userId: string,
    data: { title: string; content: string },
    file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Image is required!');
    }
    const imagePath = await this.storeImage(file);
    try {
      const created = await this.posts.create({ ...data, imagePath, creator: userId });
      return {
        message: 'Post added successfully',
        post: {
          id: created.id,
          title: created.title,
          content: created.content,
          imagePath: created.imagePath,
        },
      };
    } catch (err) {
      await this.storage.remove(imagePath);
      throw err;
    }
  }

  async list(pageSize: number, currentPage: number): Promise<PostsPage> {
    const query = this.posts.find().sort({ _id: -1 });
    if (pageSize > 0 && currentPage > 0) {
      query
        .skip(Math.min(pageSize, MAX_PAGE_SIZE) * (currentPage - 1))
        .limit(Math.min(pageSize, MAX_PAGE_SIZE));
    }
    const [docs, count] = await Promise.all([query.exec(), this.posts.countDocuments()]);
    return { message: 'Posts fetched successfully!', posts: docs.map(toDto), maxPosts: count };
  }

  async get(id: string): Promise<PostDto> {
    const post = await this.posts.findById(id);
    if (!post) {
      throw new NotFoundException('Post not found!');
    }
    return toDto(post);
  }

  /**
   * Without a new file the post keeps the image it has; an `imagePath` sent by the client is ignored,
   * so a post can never be pointed at an arbitrary URL.
   */
  async update(
    userId: string,
    id: string,
    data: { title: string; content: string },
    file: Express.Multer.File | undefined,
  ) {
    const newImagePath = file ? await this.storeImage(file) : undefined;
    const previous = await this.posts.findOneAndUpdate(
      { _id: id, creator: userId },
      {
        title: data.title,
        content: data.content,
        ...(newImagePath && { imagePath: newImagePath }),
      },
      { new: false },
    );
    if (!previous) {
      if (newImagePath) {
        await this.storage.remove(newImagePath);
      }
      throw new UnauthorizedException('Not authorized!');
    }
    if (newImagePath) {
      await this.storage.remove(previous.imagePath);
    }
    return { message: 'Post update successful!' };
  }

  async remove(userId: string, id: string) {
    const deleted = await this.posts.findOneAndDelete({ _id: id, creator: userId });
    if (!deleted) {
      throw new UnauthorizedException('Not authorized!');
    }
    await this.storage.remove(deleted.imagePath);
    return { message: 'Deletion successful!' };
  }
}
