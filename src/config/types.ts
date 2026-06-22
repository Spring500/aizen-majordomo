/** 配置字段支持的存储和校验类型。 */
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

/** enum 字段的一个可选值，用于后端校验和前端展示。 */
export interface FieldOption {
  /** 实际写入字段值的稳定标识。 */
  value: string;
  /** 展示给人类用户的选项名称。 */
  label: string;
}

/**
 * 描述卡片类型可使用的一个字段。
 *
 * 字段定义决定字段值如何校验、如何展示，以及是否能被动作或流转写入。
 */
export interface FieldDefinition {
  /** 字段唯一标识，动作、流转、过滤和持久化都通过该 id 引用字段。 */
  id: string;
  /** 展示给人类用户的字段名称。 */
  label: string;
  /** 字段用途说明，主要供配置审阅、管理界面和 agent 理解语义。 */
  description?: string;
  /** 字段值的基础类型，决定服务端校验和前端输入控件。 */
  kind: FieldKind;
  /** 为 true 时，创建卡片或声明该字段必填的动作必须提供非空值。 */
  required?: boolean;
  /** 字段默认值；仅在执行允许写该字段的 create action 时自动补入。 */
  defaultValue?: unknown;
  /** 标记是否为内置样例字段，阶段 7 会用它区分用户管理配置。 */
  system?: boolean;
  /** 为 true 时，该字段不能通过 action 或 transition 写入。 */
  readOnly?: boolean;
  /** 为 true 时，前端默认不展示该字段，但后端仍可读取和校验。 */
  hidden?: boolean;
  /** 预留的物理存储键；当前实现主要使用 field id 存储字段值。 */
  storageKey?: string;
  /** enum 字段的合法选项；kind 为 enum 时必须提供。 */
  options?: FieldOption[];
  /** 预留的扩展校验配置，用于后续更细粒度的字段校验。 */
  validation?: Record<string, unknown>;
  /** 前端展示提示或控件配置，不参与核心业务校验。 */
  ui?: Record<string, unknown>;
}

/** 卡片类型 action 的业务类别，用于表达动作意图和后续权限策略。 */
export type ActionKind = 'create' | 'update' | 'reply' | 'comment' | 'transition' | 'system';

/**
 * 描述某个卡片类型支持的一种字段动作。
 *
 * action 只表达“允许写哪些字段”的配置化动作，不负责状态变化；状态变化由 TransitionConfig 表达。
 */
export interface ActionDefinition {
  /** 动作唯一标识，例如 create、update 或 reply。 */
  id: string;
  /** 展示给人类用户的动作名称。 */
  label: string;
  /** 动作用途说明，供管理界面和 agent 理解何时使用该动作。 */
  description?: string;
  /** 动作类别，用于区分创建、编辑、回复等语义。 */
  kind: ActionKind;
  /** 该动作允许写入的字段 id 列表。 */
  writableFields: string[];
  /** 执行该动作时必须提供的字段 id 列表，字段也必须在 writableFields 中。 */
  requiredFields?: string[];
  /** 标记是否为内置样例动作，阶段 7 会用它区分用户管理配置。 */
  system?: boolean;
  /** 为 false 时该动作不可被 API 执行，也不应被前端展示。 */
  enabled?: boolean;
  /** 为 true 时该动作默认不在普通用户界面展示。 */
  hidden?: boolean;
  /** 为 true 时调用方必须提供明确 actor；阶段 4 之前主要保留给后续权限设计。 */
  requiresActor?: boolean;
  /** 允许执行该动作的角色 id；阶段 7 引入权限管理后生效。 */
  allowedRoles?: string[];
  /** 预留动作执行条件，例如字段条件或上下文条件。 */
  conditions?: Record<string, unknown>;
  /** 前端展示配置，例如按钮样式或分组。 */
  ui?: Record<string, unknown>;
  /** 预留动作副作用配置；状态变化不通过该字段表达。 */
  effects?: Record<string, unknown>;
}

/**
 * 描述一类卡片的字段能力和动作能力。
 *
 * card type 是创建、编辑、回复和流转字段校验的入口；卡片上的 type 必须能匹配一个启用的配置。
 */
export interface CardTypeConfig {
  /** 卡片类型唯一标识，例如 task、decision 或 memo。 */
  id: string;
  /** 展示给人类用户的类型名称。 */
  name: string;
  /** 类型用途说明，供配置审阅、管理界面和 agent 理解语义。 */
  description?: string;
  /** 该类型支持的字段定义。 */
  fields: FieldDefinition[];
  /** 该类型支持的字段动作定义。 */
  actions: ActionDefinition[];
  /** 为 false 时不能再创建或执行该类型的新动作；历史卡片仍可读取。 */
  enabled?: boolean;
  /** 标记是否为内置样例类型，阶段 7 会用它区分用户管理配置。 */
  system?: boolean;
  /** 前端和配置接口中的排序权重，数值越小越靠前。 */
  position?: number;
}

/**
 * 描述一个可用状态。
 *
 * status 表示卡片在工作流中的位置；合法状态变化由 TransitionConfig 决定。
 */
export interface StatusConfig {
  /** 状态唯一标识，存储在 cards.status 中。 */
  id: string;
  /** 展示给人类用户的状态名称。 */
  name: string;
  /** 状态语义分组，例如 todo、active、waiting 或 done。 */
  category?: string;
  /** 前端展示和配置接口中的排序权重，数值越小越靠前。 */
  position: number;
  /** 状态展示颜色，供前端状态标签或看板分组使用。 */
  color?: string;
  /** 为 false 时该状态不能作为新流转目标或新建初始状态。 */
  enabled?: boolean;
  /** 标记是否为内置样例状态，阶段 7 会用它区分用户管理配置。 */
  system?: boolean;
}

/**
 * 描述一条可执行的状态流转规则。
 *
 * transition 是状态变化的业务入口：调用方指定 transition id 后，
 * 服务会校验卡片类型、当前状态和随流转写入的字段，再把卡片推进到 toStatus。
 */
export interface TransitionConfig {
  /** 流转唯一标识。前端按钮、API 请求和 hook action 都通过该 id 引用流转。 */
  id: string;
  /** 展示给人类用户的流转名称，例如“开始处理”或“提交回复”。 */
  name: string;
  /** 限定适用的卡片类型；为 null 或未设置时表示适用于所有卡片类型。 */
  cardType?: string | null;
  /** 要求卡片当前处于的来源状态；为 null 或未设置时表示可从任意状态执行。 */
  fromStatus?: string | null;
  /** 执行成功后写入 cards.status 的目标状态。 */
  toStatus: string;
  /** 本次流转允许顺带写入的字段 id 列表，不等同于普通 update action 的可写字段。 */
  writableFields: string[];
  /** 本次流转必须提供的字段 id 列表，字段必须同时出现在 writableFields 中。 */
  requiredFields?: string[];
  /** 为 false 时该流转不可被前端展示，也不可被 API 执行。 */
  enabled?: boolean;
  /** 标记是否为内置样例配置，阶段 7 会用它区分用户管理配置。 */
  system?: boolean;
}

/**
 * 描述 hook 可执行的动作模型。
 *
 * 阶段 2 只定义模型，阶段 8 会根据该模型执行 transition、webhook 或 script。
 */
export interface HookActionModelConfig {
  /** hook action model 唯一标识，例如 transition、webhook 或 script。 */
  id: string;
  /** 展示给人类用户的动作模型名称。 */
  name: string;
  /** 动作模型用途说明。 */
  description?: string;
  /** 动作参数 schema；当前按 JSON 配置保存，阶段 8 执行时解释。 */
  schema: Record<string, unknown>;
  /** 为 false 时该动作模型不可被新的 hook 引用。 */
  enabled?: boolean;
  /** 标记是否为内置样例 hook action model。 */
  system?: boolean;
}

/**
 * 描述事件发生后要尝试执行的 hook。
 *
 * 阶段 4 不执行 hook，但 transition changes 会为阶段 8 的事件匹配提供事实来源。
 */
export interface HookConfig {
  /** hook 唯一标识。 */
  id: string;
  /** 展示给人类用户的 hook 名称。 */
  name: string;
  /** 触发该 hook 的事件名，例如 card.transition.start。 */
  event: string;
  /** 事件匹配条件；为 null 或未设置时表示只按 event 匹配。 */
  match?: Record<string, unknown> | null;
  /** hook 动作配置，必须包含能匹配 HookActionModelConfig 的 type。 */
  action: Record<string, unknown>;
  /** 为 false 时该 hook 不应被执行。 */
  enabled?: boolean;
  /** 标记是否为内置样例 hook。 */
  system?: boolean;
}

/** 当前运行时的完整看板配置快照，由 SQLite 配置表读取生成。 */
export interface AppConfig {
  /** 可用卡片类型配置。 */
  cardTypes: CardTypeConfig[];
  /** 可用状态配置。 */
  statuses: StatusConfig[];
  /** 可执行状态流转配置。 */
  transitions: TransitionConfig[];
  /** hook 动作模型配置。 */
  hookActionModels: HookActionModelConfig[];
  /** hook 配置。 */
  hooks: HookConfig[];
  /** 运行时默认值；未配置时按各模块的兜底逻辑处理。 */
  defaults?: WorkspaceDefaults;
}

/** 运行时默认值配置。 */
export interface WorkspaceDefaults {
  /** 新建卡片未指定 status 时的默认状态 id，必须引用已启用的状态。 */
  status?: string;
}

/** 配置校验结果；失败时 errors 给出可读的配置引用或结构错误。 */
export type ConfigValidationResult = { ok: true } | { ok: false; errors: string[] };
