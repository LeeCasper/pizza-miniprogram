import { ref, reactive, computed } from 'vue';
import { useRoute } from 'vue-router';
import { defineStore } from 'pinia';
import { useLoading } from '@sa/hooks';
import { fetchGetUserInfo, fetchLogin } from '@/service/api';
import { useRouterPush } from '@/hooks/common/router';
import { localStg } from '@/utils/storage';
import { SetupStoreId } from '@/enum';
import { useRouteStore } from '../route';
import { useTabStore } from '../tab';
import { clearAuthStorage, getToken } from './shared';

export const useAuthStore = defineStore(SetupStoreId.Auth, () => {
  const route = useRoute();
  const authStore = useAuthStore();
  const routeStore = useRouteStore();
  const tabStore = useTabStore();
  const { toLogin, redirectFromLogin } = useRouterPush(false);
  const { loading: loginLoading, startLoading, endLoading } = useLoading();

  const token = ref('');

  const userInfo: Api.Auth.UserInfo = reactive({
    userId: '',
    userName: '',
    roles: [],
    buttons: []
  });

  /** Is login */
  const isLogin = computed(() => Boolean(token.value));

  /** Reset auth store */
  async function resetStore() {
    clearAuthStorage();
    authStore.$reset();

    if (!route.meta.constant) {
      await toLogin();
    }

    tabStore.cacheTabs();
    routeStore.resetStore();
  }

  /**
   * Login
   */
  async function login(username: string, password: string, redirect = true) {
    startLoading();

    const { data: loginData, error } = await fetchLogin(username, password);

    if (!error && loginData) {
      // Store token
      localStg.set('token', loginData.token);
      token.value = loginData.token;

      // Set user info from login response
      userInfo.userId = String(loginData.user.id);
      userInfo.userName = loginData.user.displayName || loginData.user.username;

      await redirectFromLogin(redirect);

      window.$notification?.success({
        title: '登录成功',
        content: `欢迎回来，${loginData.user.displayName || loginData.user.username}`,
        duration: 4500
      });
    } else {
      resetStore();
    }

    endLoading();
  }

  async function getUserInfo() {
    const { data: info, error } = await fetchGetUserInfo();

    if (!error && info) {
      userInfo.userId = String(info.id);
      userInfo.userName = info.displayName || info.username;
      return true;
    }

    return false;
  }

  async function initUserInfo() {
    const maybeToken = getToken();

    if (maybeToken) {
      token.value = maybeToken;
      const pass = await getUserInfo();

      if (!pass) {
        resetStore();
      }
    }
  }

  return {
    token,
    userInfo,
    isLogin,
    loginLoading,
    resetStore,
    login,
    initUserInfo
  };
});
