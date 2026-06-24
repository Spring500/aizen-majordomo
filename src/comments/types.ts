/** transition 附带说明保存后的最小评论响应。 */
export interface Comment {
  /** 评论唯一标识。 */
  id: string;
  /** 评论所属卡片 id。 */
  cardId: string;
  /** 评论作者；阶段 4 使用请求 actor，未传时为 human。 */
  author: string;
  /** 评论正文。空白评论不会被 transition 服务写入。 */
  content: string;
  /** 创建时间戳，单位毫秒。 */
  createdAt: number;
}
