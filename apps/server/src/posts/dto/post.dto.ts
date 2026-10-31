import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class UpdatePostDto extends CreatePostDto {
  /** Accepted for older clients, which send the current image URL back; the server ignores it. */
  @IsOptional()
  @IsString()
  imagePath?: string;
}

export class ListPostsQuery {
  @IsOptional()
  pagesize?: string;

  @IsOptional()
  page?: string;
}
