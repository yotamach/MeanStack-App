import {
  Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { memoryStorage } from 'multer';
import { AuthedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { CreatePostDto, ListPostsQuery, UpdatePostDto } from './dto/post.dto';
import { PostsService } from './posts.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const imageUpload = () =>
  FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });

const baseUrl = (req: Request) => `${req.protocol}://${req.get('host')}`;

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(imageUpload())
  create(@Req() req: AuthedRequest, @Body() dto: CreatePostDto, @UploadedFile() file?: Express.Multer.File) {
    return this.posts.create(req.user.userId, dto, file, baseUrl(req));
  }

  @Get()
  list(@Query() q: ListPostsQuery) {
    return this.posts.list(+(q.pagesize ?? 0) || 0, +(q.page ?? 0) || 0);
  }

  @Get(':id')
  get(@Param('id', ParseObjectIdPipe) id: string) {
    return this.posts.get(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(imageUpload())
  update(
    @Req() req: AuthedRequest,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdatePostDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.posts.update(req.user.userId, id, dto, file, baseUrl(req));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: AuthedRequest, @Param('id', ParseObjectIdPipe) id: string) {
    return this.posts.remove(req.user.userId, id);
  }
}
