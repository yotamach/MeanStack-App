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
  /** Existing image URL, sent when the image was not replaced. */
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
