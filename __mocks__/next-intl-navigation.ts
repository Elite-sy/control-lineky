/**
 * Mock for next-intl/navigation exports
 */

export const createNavigation = jest.fn((config: any) => ({
  Link: jest.fn(({ children }: any) => children),
  redirect: jest.fn((href: string) => {}),
  usePathname: jest.fn(() => '/'),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  })),
}));

export const Link = jest.fn(({ children }: any) => children);
export const redirect = jest.fn((href: string) => {});
export const usePathname = jest.fn(() => '/');
export const useRouter = jest.fn(() => ({
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
}));
