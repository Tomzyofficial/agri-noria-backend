// export function assertPlacementTarget(
//   surfaces,
//   targetType,
//   vendorId,
//   targetId,
// ) {
//   if (surfaces === "Home") {
//     if (targetType !== "Product") {
//       return {
//         ok: false,
//         message: "Product campaigns must surface in home page marketplace ",
//       };
//     }
//     return { ok: true };
//   }

//   if (surfaces === "SPONSORED_PRODUCT" || surfaces === "SEARCH_BOOST") {
//     if (targetType !== "PRODUCT") {
//       return {
//         ok: false,
//         message: `${surfaces} campaigns must target PRODUCT (listing)`,
//       };
//     }
//     return { ok: true };
//   }

//   if (placement === "PROMOTED_TRAINING") {
//     if (targetType !== "TRAINING") {
//       return {
//         ok: false,
//         message: "PROMOTED_TRAINING campaigns must target TRAINING",
//       };
//     }
//     return { ok: true };
//   }

//   if (placement === "HOMEPAGE_FEATURED") {
//     return { ok: true };
//   }

//   return { ok: false, message: "Unknown placement" };
// }

export function assertPlacementTarget(surfaces, targetType) {
  console.log(surfaces, targetType);
  switch (surfaces) {
    case "Home":
      if (targetType !== "Product") {
        return {
          ok: false,
          message: "Product campaigns must surface in home page marketplace ",
        };
      }
      return { ok: true };
    case "Drone_marketplace":
      if (targetType !== "Product") {
        return {
          ok: false,
          message: "Product campaigns must surface in drone marketplace ",
        };
      }
      return { ok: true };
    case "Storage_marketplace":
      if (targetType !== "Storage_listing") {
        return {
          ok: false,
          message: "Storage campaigns must surface in storage marketplace ",
        };
      }
      return { ok: true };
    case "Logistics_marketplace":
      if (targetType !== "Logistics_service") {
        return {
          ok: false,
          message: "Logistics campaigns must surface in logistics marketplace ",
        };
      }
      return { ok: true };
    case "Farm_services":
      if (targetType !== "Farm_service") {
        return {
          ok: false,
          message:
            "Farm service campaigns must surface in farm services marketplace ",
        };
      }
      return { ok: true };
    case "Training":
      if (targetType !== "Agricultural_training") {
        return {
          ok: false,
          message: "Training campaigns must surface in training marketplace ",
        };
      }
      return { ok: true };
    case "Jobs":
      if (targetType !== "Agricultural_employment") {
        return {
          ok: false,
          message: "Job campaigns must surface in job marketplace ",
        };
      }
      return { ok: true };
    default:
      return {
        ok: false,
        message: "Unknown surface",
      };
  }
}
