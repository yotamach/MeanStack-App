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

  private async storeImage(file: Express.Multer.File, baseUrl: string): Promise<string> {
    const ext = detectImageExt(file.buffer);
    if (!ext) {
      throw new BadRequestException('Invalid mime type');
    }
    const name = await this.storage.save(
      file.buffer,
      file.originalname.replace(/\.[^.]*$/, ''),
      ext,
    );
    return `${baseUrl}/images/${name}`;
  }

  async create(
    userId: string,
    data: { title: string; content: string },
    file: Express.Multer.File | undefined,
    baseUrl: string,
  ) {
    if (!file) {
      throw new BadRequestException('Image is required!');
    }
    const imagePath = await this.storeImage(file, baseUrl);
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

  async update(
    userId: string,
    id: string,
    data: { title: string; content: string; imagePath?: string },
    file: Express.Multer.File | undefined,
    baseUrl: string,
  ) {
    let imagePath = data.imagePath;
    if (file) {
      imagePath = await this.storeImage(file, baseUrl);
    }
    if (!imagePath) {
      throw new BadRequestException('Image is required!');
    }
    const result = await this.posts.updateOne(
      { _id: id, creator: userId },
      { title: data.title, content: data.content, imagePath },
    );
    if (result.matchedCount === 0) {
      throw new UnauthorizedException('Not authorized!');
    }
    return { message: 'Post update successful!' };
  }

  async remove(userId: string, id: string) {
    const result = await this.posts.deleteOne({ _id: id, creator: userId });
    if (result.deletedCount === 0) {
      throw new UnauthorizedException('Not authorized!');
    }
    return { message: 'Deletion successful!' };
  }
}
