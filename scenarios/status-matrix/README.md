# status-matrix

## 内容

包含 `task` 类型和 `triage`、`doing`、`blocked`、`done` 四个状态。

## 用途

验证状态配置会影响建卡、列表读取和状态筛选。

## 启动

`pnpm scenario:start status-matrix`

## 观察点

左侧状态筛选应显示待分拣、处理中、受阻、完成；选择受阻时只显示 blocked 卡。

## 备注

seed 为每个状态各创建一张卡。
