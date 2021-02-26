import { DSL } from '@/store/type-map';
import { ISTIO } from '@/config/types';
import { STATE, NAME as NAME_HEADER, AGE } from '@/config/table-headers';
import { getAllGateways } from '@/utils';

export const NAME = 'istio';
export const CHART_NAME = 'rancher-istio';

// change from route to gateway
// came from alertmanagerconfig.js in utils
export async function getAllGateways(dispatch) {
  try {
    const { config, secret } = await loadConfig(dispatch);

    config.gateway = config.gateway || {};
    config.route.name = ROOT_NAME;
    const routes = config.route?.routes || [];

    setDefaultRouteNames(routes);

    routes.push(config.route);

    const mapped = routes.map((route) =>
      dispatch(
        'cluster/create',
        {
          id: route.name,
          spec: route,
          type: MONITORING.SPOOFED.ROUTE, //ISTIO.SPOOFED.GATEWAY?
          secret,
        },
        { root: true }
      )
    );

    return Promise.all(mapped);
  } catch (ex) {
    return [];
  }
}

export function init(store) {
  const { product, basicType, virtualType, headers } = DSL(store, NAME);

  product({
    ifHaveGroup: /^(.*\.)*istio\.io$/,
    icon: 'istio',
  });

  virtualType({
    label: 'Overview',
    group: 'Root',
    namespaced: false,
    name: 'istio-overview',
    weight: 100,
    route: { name: 'c-cluster-istio' },
    exact: true,
  });

  // convert to Gateways
  spoofedType({
    label: 'Routes',
    type: ROUTE,
    schemas: [
      {
        id: ROUTE,
        type: 'schema',
        collectionMethods: ['POST'],
        resourceFields: { spec: { type: ROUTE_SPEC } },
      },
      {
        id: ROUTE_SPEC,
        type: 'schema',
        resourceFields: {
          receiver: { type: 'string' },
          group_by: { type: 'array[string]' },
          group_wait: { type: 'string' },
          group_interval: { type: 'string' },
          repeat_interval: { type: 'string' },
          match: { type: 'map[string]' },
          match_re: { type: 'map[string]' },
        },
      },
    ],
    getInstances: () => getAllRoutes(store.dispatch),
  });

  mapType(ROUTE, store.getters['i18n/t'](`typeLabel.${ROUTE}`, { count: 2 }));

  basicType(['istio-overview', GATEWAY]);

  basicType([
    'networking.istio.io.virtualservice',
    'networking.istio.io.gateway',
    'networking.istio.io.destinationrule',
  ]);

  basicType(
    [
      'networking.istio.io.envoyfilter',
      'networking.istio.io.serviceentrie',
      'networking.istio.io.sidecar',
      'networking.istio.io.workloadentrie',
    ],
    'Networking'
  );

  basicType(
    [
      'rbac.istio.io.clusterrbacconfig',
      'rbac.istio.io.rbacconfig',
      'rbac.istio.io.servicerolebinding',
      'rbac.istio.io.servicerole',
    ],
    'RBAC'
  );

  basicType(
    [
      'security.istio.io.authorizationpolicie',
      'security.istio.io.peerauthentication',
      'security.istio.io.requestauthentication',
    ],
    'Security'
  );

  headers(ISTIO.VIRTUAL_SERVICE, [
    STATE,
    NAME_HEADER,
    {
      name: 'gateways',
      label: 'Gateways',
      value: 'spec',
      formatter: 'VirtualServiceGateways',
    },
    {
      name: 'hosts',
      label: 'Hosts',
      value: 'spec.hosts',
      sort: ['spec.hosts'],
      formatter: 'List',
    },
    AGE,
  ]);

  // Convert to gateway
  headers(ROUTE, [
    NAME_COL,
    {
      name: 'receiver',
      label: 'Configured Receiver',
      value: 'spec.receiver',
      sort: 'spec.receiver',
      width: '85%',
    },
  ]);
}
