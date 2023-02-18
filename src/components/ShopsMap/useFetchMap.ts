import {
  ShopsDocument,
  ShopsQuery,
} from "@/components/ShopsMap/Shops.cms.generated";
import { gqlRequest } from "@/hooks/useReactQuery";
import { useEffect, useReducer, useState } from "react";

function sortArray(a: any, b: any) {
  if (a.name != null && b.name != null) {
    if (!a.name || a.name < b.name) {
      return -1;
    } else if (!b.name || a.name > b.name) {
      return 1;
    }
    return 0;
  } else {
    return 0;
  }
}

export type FilterStateType = {
  filters: {
    type?: string | null;
    category?: string | null;
    state?: string | null;
    search?: string | null;
    center: [number, number];
    zoom: number | null;
  };
  shops: ShopsQuery["shops"] | null;
  data: ShopsQuery | null;
};
export const initialState: FilterStateType = {
  filters: {
    type: null,
    category: null,
    state: null,
    search: null,
    center: [51.1657, 10.2336],
    zoom: 6,
  },
  shops: null,
  data: null,
};

export type FilterActionType =
  | {
      type: "SET_CATEGORY";
      payload?: string | null;
    }
  | {
      type: "SET_SEARCH";
      payload?: string | null;
    }
  | {
      type: "SET_STATE";
      payload?: ShopsQuery["shopBundeslands"][0] | null;
    }
  | {
      type: "SET_TYPE";
      payload?: string | null;
    }
  | { type: "APPLY_FILTERS" }
  | { type: "SET_DATA"; payload: ShopsQuery | null };

export const filterActions = {
  setCategory: (category: string | null) => ({
    type: "SET_CATEGORY",
    payload: category,
  }),
};

export const applyShopFilter = (state: FilterStateType) => {
  const { filters, data } = state;
  let shops: ShopsQuery["shops"] | null = [...(data?.shops ?? [])];
  if (filters.category) {
    shops =
      shops?.filter(
        (s) =>
          (s.shopcategories ?? []).filter((ct) => filters.category === ct.name)
            .length > 0
      ) ?? null;
  }
  if (filters.type) {
    shops =
      shops?.filter(
        (s) =>
          (s.shopType ?? []).filter((t) => filters.type === t.name).length > 0
      ) ?? null;
  }
  if (filters.state) {
    shops =
      shops?.filter((s) => s.shopBundesland?.name === filters.state) ?? null;
  }
  if (filters.search) {
    const regexp = new RegExp(`${filters.search}`, "i");
    shops =
      shops?.filter(
        (s) =>
          regexp.test(s.name ?? "") ||
          regexp.test(s.shopcategories.join(", ")) ||
          regexp.test(s.shopTown?.name ?? "")
      ) ?? null;
  }
  return shops;
};

export const reducer = (state: FilterStateType, action: FilterActionType) => {
  switch (action.type) {
    case "SET_CATEGORY": {
      if (state.filters.category === action.payload) {
        return {
          ...state,
          filters: {
            ...state.filters,
            category: null,
          },
          shops: null,
        } as FilterStateType;
      }
      return {
        ...state,
        filters: {
          ...state.filters,
          category: action.payload,
        },
        shops: null,
      } as FilterStateType;
    }

    case "SET_STATE": {
      if (action.payload?.name === state.filters.state) {
        return {
          ...state,

          filters: {
            ...state.filters,
            state: null,
          },
          shops: null,
        } as FilterStateType;
      }
      return {
        ...state,

        filters: {
          ...state.filters,
          state: action.payload?.name,
          center: [
            action.payload?.location?.latitude ?? 0,
            action.payload?.location?.longitude ?? 0,
          ],
          zoom: action.payload?.zoom ?? 6,
        },
        shops: null,
      } as FilterStateType;
    }
    case "SET_TYPE": {
      if (action.payload === state.filters.type) {
        return {
          ...state,
          filters: {
            ...state.filters,
            type: null,
          },
          shops: null,
        } as FilterStateType;
      }
      return {
        ...state,
        filters: {
          ...state.filters,
          type: action.payload,
        },
        shops: null,
      } as FilterStateType;
    }
    case "SET_SEARCH": {
      if (action.payload === state.filters.search) {
        return {
          ...state,
          filters: {
            ...state.filters,
            search: null,
          },
          shops: null,
        } as FilterStateType;
      }
      return {
        ...state,
        filters: {
          ...state.filters,
          search: action.payload,
        },
        shops: null,
      } as FilterStateType;
    }
    case "APPLY_FILTERS":
      return { ...state, shops: applyShopFilter(state) } as FilterStateType;
    case "SET_DATA":
      let states = action.payload?.shopBundeslands;
      let categories = action.payload?.shopCategories;
      let types = action.payload?.shopTypes;
      if (states != null) {
        states.sort(sortArray);
      }
      if (categories != null) {
        categories.sort(sortArray);
      }
      if (types != null) {
        types.sort(sortArray);
      }
      return {
        ...state,
        data: action.payload,
        shops: action.payload?.shops,
      } as FilterStateType;
    default:
      throw new Error();
  }
};

async function fetchAllShops(
  endCursor: string | null = null
): Promise<ShopsQuery> {
  const res = await gqlRequest(
    ShopsDocument,
    endCursor ? { endCursor } : {},
    `https://api-eu-central-1.graphcms.com/v2/${process.env.GQL_CMS_ID}/master`
  );
  if (res.shopsConnection.pageInfo.hasNextPage) {
    return {
      ...res,
      shops: [
        ...res.shops,
        ...(await fetchAllShops(res.shopsConnection.pageInfo.endCursor)).shops,
      ],
    };
  }
  return res;
}

let shopsQuery: ShopsQuery | null = null;

export const useFetchMap = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const dispatchAction = (action: FilterActionType) => {
    dispatch(action);
    setTimeout(() => {
      dispatch({ type: "APPLY_FILTERS" });
    }, 100);
  };
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (!state.shops) {
      if (!shopsQuery) {
        setIsLoading(true);
        fetchAllShops().then((shops) => {
          setIsLoading(false);
          shopsQuery = shops;
          dispatch({ type: "SET_DATA", payload: shops });
        });
      } else {
        dispatch({ type: "SET_DATA", payload: shopsQuery });
      }
    }
  }, [dispatch, state.shops]);

  return {
    isLoading,
    dispatchAction,
    state,
  };
};
