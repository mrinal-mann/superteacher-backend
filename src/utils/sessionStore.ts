import { SessionData, ConversationStep } from '../types';

/**
 * A simple in-memory store for user sessions
 * In production, this would be replaced with Redis or another session store
 */
class SessionStore {
  private sessions: Map<string, SessionData>;

  constructor() {
    this.sessions = new Map<string, SessionData>();
  }

  /**
   * Initialize or retrieve a session for a user
   */
  getSession(userId: string): SessionData {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        userId,
        question: null,
        studentAnswer: null,
        marks: null,
        step: ConversationStep.WAITING_FOR_QUESTION
      });
    }
    
    return this.sessions.get(userId)!;
  }

  /**
   * Update a session with new data
   */
  updateSession(userId: string, data: Partial<SessionData>): SessionData {
    const currentSession = this.getSession(userId);
    const updatedSession = { ...currentSession, ...data };
    this.sessions.set(userId, updatedSession);
    return updatedSession;
  }

  /**
   * Reset a session to initial state
   */
  resetSession(userId: string): void {
    this.sessions.set(userId, {
      userId,
      question: null,
      studentAnswer: null,
      marks: null,
      step: ConversationStep.WAITING_FOR_QUESTION
    });
  }
}

// Export a singleton instance
export const sessionStore = new SessionStore();