import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ErrorCode, ErrorDetail, ErrorResponse } from './types.js';

/** 공통 오류 스키마(ErrorResponse)로 응답한다. 내부 정보는 담지 않는다. */
export function sendError(
  reply: FastifyReply,
  req: FastifyRequest,
  status: number,
  code: ErrorCode,
  message: string,
  details?: ErrorDetail[],
): FastifyReply {
  const body: ErrorResponse = {
    code,
    message,
    requestId: String(req.id),
    ...(details && details.length > 0 ? { details } : {}),
  };
  return reply.status(status).type('application/json; charset=utf-8').send(body);
}
