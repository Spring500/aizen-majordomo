/** 前端支持的字段类型，来自后端配置模型。 */
export type FieldKind =
  | 'text'
  | 'longText'
  | 'number'
  | 'boolean'
  | 'stringList'
  | 'enum'
  | 'actor'
  | 'datetime'
  | 'json';

/** 前端渲染动态表单时使用的字段定义。 */
export interface FieldDefinition {
  /** 字段唯一标识，表单提交时作为 fields 的 key。 */
  id: string;
  /** 展示给用户的字段名称。 */
  label: string;
  /** 字段输入和展示类型。 */
  kind: FieldKind;
  /** 为 true 时前端可提示必填；最终以后端校验为准。 */
  required?: boolean;
  /** 创建时的默认值，前端可用于初始表单值。 */
  defaultValue?: unknown;
  /** enum 字段的可选项。 */
  options?: Array<{ value: string; label: string }>;
  /** 为 true 时默认不在普通字段列表中展示。 */
  hidden?: boolean;
}

/** 前端用于判断普通字段动作可写范围的 action 配置。 */
export interface ActionDefinition {
  /** 动作唯一标识，例如 update 或 reply。 */
  id: string;
  /** 展示给用户的动作名称。 */
  label: string;
  /** 动作业务类别；前端只做展示和入口判断。 */
  kind: string;
  /** 该动作允许写入的字段 id 列表。 */
  writableFields: string[];
  /** 该动作必须填写的字段 id 列表。 */
  requiredFields?: string[];
  /** 为 false 时前端不展示该动作入口。 */
  enabled?: boolean;
}

/** 前端创建、编辑和详情展示使用的卡片类型配置。 */
export interface CardTypeConfig {
  /** 卡片类型唯一标识，对应 card.type。 */
  id: string;
  /** 展示给用户的类型名称。 */
  name: string;
  /** 该类型可展示和可写入的字段定义。 */
  fields: FieldDefinition[];
  /** 该类型支持的普通字段动作。 */
  actions: ActionDefinition[];
  /** 为 false 时前端不应作为新建类型展示。 */
  enabled?: boolean;
}

/** 前端展示卡片状态时使用的状态配置。 */
export interface StatusConfig {
  /** 状态唯一标识，对应 card.status。 */
  id: string;
  /** 展示给用户的状态名称。 */
  name: string;
  /** 为 false 时前端不应作为可选或目标状态展示。 */
  enabled?: boolean;
  /** 为 false 时该状态不能作为新建卡片的初始状态。 */
  allowAsInitial?: boolean;
}

/** 前端渲染和提交状态流转时使用的 transition 配置。 */
export interface TransitionConfig {
  /** 流转唯一标识，请求 `POST /cards/:id/transition` 时作为 transitionId 传递。 */
  id: string;
  /** 展示给用户的按钮或操作名称。 */
  name: string;
  /** 限定卡片类型；为空时表示所有卡片类型都可考虑该流转。 */
  cardType?: string | null;
  /** 限定来源状态；为空时表示可从任意状态执行。 */
  fromStatus?: string | null;
  /** 执行成功后的目标状态。 */
  toStatus: string;
  /** 执行该流转时允许填写的字段。 */
  writableFields: string[];
  /** 执行该流转时必须填写的字段。 */
  requiredFields?: string[];
  /** 为 false 时前端不展示该流转。 */
  enabled?: boolean;
}

/** 前端一次性读取到的运行时配置。 */
export interface AppConfig {
  /** 可用卡片类型配置。 */
  cardTypes: CardTypeConfig[];
  /** 可用状态配置。 */
  statuses: StatusConfig[];
  /** 可用状态流转配置。 */
  transitions: TransitionConfig[];
  /** hook 动作模型配置；阶段 4 前端不解释其结构。 */
  hookActionModels: unknown[];
  /** hook 配置；阶段 4 前端不解释其结构。 */
  hooks: unknown[];
  /** 运行时默认值。 */
  defaults?: { status?: string };
}

/** 卡片类型 id。 */
export type CardType = string;

/** 前端列表和详情使用的卡片响应结构。 */
export interface Card {
  /** 卡片唯一标识。 */
  id: string;
  /** 卡片类型 id。 */
  type: CardType;
  /** 配置化字段值集合。 */
  fields: Record<string, unknown>;
  /** 当前状态 id；只能通过 transition 改变。 */
  status: string;
  /** 创建者标识。 */
  created_by: string;
  /** 创建时间戳，单位毫秒。 */
  created_at: number;
  /** 更新时间戳，单位毫秒。 */
  updated_at: number;
}

/** 卡片列表筛选和分页参数。 */
export interface CardFilters {
  /** 卡片类型筛选；空字符串表示不过滤类型。 */
  type: CardType | '';
  /** 状态筛选。 */
  status?: string;
  /** 配置化字段精确筛选。 */
  fields?: Record<string, string>;
  /** 每页数量。 */
  limit?: number;
  /** 分页偏移量。 */
  offset?: number;
}
