declare namespace Express {
  interface Request {
    auth?: {
      userId: string;
      email: string;
      sessionId: string;
    };
    authUser?: {
      id: string;
      googleId: string;
      name: string | null;
      email: string;
      avatar: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }
}
