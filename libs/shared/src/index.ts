export interface Post {
  _id: string;
  title: string;
  content: string;
  imagePath: string;
  creator: string;
}

export interface PostsPage {
  message: string;
  posts: Post[];
  maxPosts: number;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
  userId: string;
}

export interface SignupResponse {
  message: string;
  result: { id: string; email: string };
}

export interface ApiError {
  message: string;
}
