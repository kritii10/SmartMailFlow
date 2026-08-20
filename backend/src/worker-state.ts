export type WorkerRuntimeStatus =
  | "not_started"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "error";

let workerRuntimeStatus: WorkerRuntimeStatus = "not_started";

export const setWorkerRuntimeStatus = (status: WorkerRuntimeStatus) => {
  workerRuntimeStatus = status;
};

export const getWorkerRuntimeStatus = () => workerRuntimeStatus;
