import type { AxiosResponse } from 'axios';
import { BACKEND_ERROR_CODE, createFlatRequest, createRequest } from '@sa/axios';
import { useAuthStore } from '@/store/modules/auth';
import { localStg } from '@/utils/storage';
import { getAuthorization, showErrorMsg } from './shared';
import type { RequestInstanceState } from './type';

const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';

// Admin API base URL
const ADMIN_BASE = '/api/v1/admin';

export const request = createFlatRequest(
  {
    baseURL: ADMIN_BASE
  },
  {
    defaultState: {
      errMsgStack: [],
      refreshTokenPromise: null
    } as RequestInstanceState,
    transform(response: AxiosResponse<App.Service.Response<any>>) {
      return response.data.data;
    },
    async onRequest(config) {
      const Authorization = getAuthorization();
      Object.assign(config.headers, { Authorization });
      return config;
    },
    isBackendSuccess(response) {
      return String(response.data.code) === import.meta.env.VITE_SERVICE_SUCCESS_CODE;
    },
    async onBackendFail(response, instance) {
      const authStore = useAuthStore();
      const responseCode = String(response.data.code);

      // 401 or non-zero code: clear auth and redirect to login
      if (responseCode === '401' || response.status === 401) {
        authStore.resetStore();
        return null;
      }

      // Show error message
      const msg = response.data.message || response.data.msg || '请求失败';
      showErrorMsg(request.state, msg);

      return null;
    },
    onError(error) {
      let message = error.message;
      let backendErrorCode = '';

      if (error.code === BACKEND_ERROR_CODE) {
        message = error.response?.data?.message || error.response?.data?.msg || message;
        backendErrorCode = String(error.response?.data?.code || '');
      }

      // 401 Unauthorized
      if (backendErrorCode === '401' || error.response?.status === 401) {
        const authStore = useAuthStore();
        authStore.resetStore();
        return;
      }

      showErrorMsg(request.state, message);
    }
  }
);
