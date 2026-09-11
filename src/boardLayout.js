export function edgeKey(fromId, toId) {
  return `${fromId}->${toId}`
}

export function layoutBoard(board) {
  const positions = {}
  const edgeRoutes = {}

  const mainIndexById = Object.fromEntries(
    board.mainPath.map((id, index) => [id, index])
  )

  // --------------------------------
  // MAIN BOARD SHAPE
  // --------------------------------

  const centerX = 500
  const amplitude = 260

  // Distance between normal board spaces.
  const verticalGap = 105

  const topMargin = 130

  // Controls how quickly the board bends left/right.
  const waveLength = 15

  board.mainPath.forEach((id, index) => {
    const angle =
      (index / waveLength) *
      Math.PI *
      2

    positions[id] = {
      x:
        centerX +
        Math.sin(angle) *
          amplitude,

      y:
        topMargin +
        index * verticalGap,
    }
  })

  // Normal main-path connections.
  for (
    let index = 0;
    index < board.mainPath.length - 1;
    index++
  ) {
    const fromId =
      board.mainPath[index]

    const toId =
      board.mainPath[index + 1]

    edgeRoutes[
      edgeKey(fromId, toId)
    ] = [
      positions[fromId],
      positions[toId],
    ]
  }

  // --------------------------------
  // HELPERS
  // --------------------------------

  function getMainSegmentBounds(
    startIndex,
    endIndex
  ) {
    const xs = []

    for (
      let index = startIndex;
      index <= endIndex;
      index++
    ) {
      const id =
        board.mainPath[index]

      if (positions[id]) {
        xs.push(positions[id].x)
      }
    }

    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
    }
  }

  function createOutsideLane(
    startIndex,
    endIndex,
    preferredSide,
    extraDistance = 0
  ) {
    const bounds =
      getMainSegmentBounds(
        startIndex,
        endIndex
      )

    const distance =
      210 + extraDistance

    if (preferredSide === 'left') {
      return bounds.minX - distance
    }

    return bounds.maxX + distance
  }

  function makeBranch(
    pathIds,
    startId,
    endId,
    laneX
  ) {
    const start = positions[startId]
    const end = positions[endId]

    if (!start || !end) return

    pathIds.forEach((id, index) => {
      const t =
        (index + 1) /
        (pathIds.length + 1)

      // Small outward bow so it looks like a branch
      // rather than one perfectly straight line.
      const direction =
        laneX < centerX ? -1 : 1

      const bow =
        Math.sin(Math.PI * t) *
        25 *
        direction

      positions[id] = {
        x: laneX + bow,

        y:
          start.y +
          (end.y - start.y) * t,
      }
    })

    if (pathIds.length === 0) return

    const firstId = pathIds[0]

    // Leave the main route outward instead of
    // cutting diagonally through it.
    edgeRoutes[
      edgeKey(startId, firstId)
    ] = [
      start,

      {
        x:
          start.x +
          (laneX - start.x) * 0.45,

        y:
          start.y +
          verticalGap * 0.38,
      },

      positions[firstId],
    ]

    // Middle of branch.
    for (
      let index = 0;
      index < pathIds.length - 1;
      index++
    ) {
      const fromId =
        pathIds[index]

      const toId =
        pathIds[index + 1]

      edgeRoutes[
        edgeKey(fromId, toId)
      ] = [
        positions[fromId],
        positions[toId],
      ]
    }

    const lastId =
      pathIds[pathIds.length - 1]

    // Rejoin without cutting across the main route.
    edgeRoutes[
      edgeKey(lastId, endId)
    ] = [
      positions[lastId],

      {
        x:
          end.x +
          (laneX - end.x) * 0.45,

        y:
          end.y -
          verticalGap * 0.38,
      },

      end,
    ]
  }

  // --------------------------------
  // NORMAL FORKS
  // --------------------------------

  const forkRanges = []

  board.forks.forEach(
    (fork, forkIndex) => {
      const splitIndex =
        mainIndexById[fork.splitId]

      const rejoinIndex =
        mainIndexById[fork.rejoinId]

      if (
        splitIndex === undefined ||
        rejoinIndex === undefined
      ) {
        return
      }

      const bounds =
        getMainSegmentBounds(
          splitIndex,
          rejoinIndex
        )

      // Put the branch on whichever side of this
      // piece of main path has more breathing room.
      const distanceFromLeft =
        bounds.minX

      const distanceFromRight =
        1000 - bounds.maxX

      let side

      if (
        Math.abs(
          distanceFromLeft -
            distanceFromRight
        ) > 100
      ) {
        side =
          distanceFromLeft >
          distanceFromRight
            ? 'left'
            : 'right'
      } else {
        side =
          forkIndex % 2 === 0
            ? 'left'
            : 'right'
      }

      const laneX =
        createOutsideLane(
          splitIndex,
          rejoinIndex,
          side
        )

      makeBranch(
        fork.alternatePath,
        fork.splitId,
        fork.rejoinId,
        laneX
      )

      forkRanges.push({
        start: splitIndex,
        end: rejoinIndex,
        side,
      })
    }
  )

  // --------------------------------
  // SHORTCUT
  // --------------------------------

  if (board.shortcut) {
    const gateIndex =
      mainIndexById[
        board.shortcut.gateId
      ]

    const rejoinIndex =
      mainIndexById[
        board.shortcut.rejoinId
      ]

    if (
      gateIndex !== undefined &&
      rejoinIndex !== undefined
    ) {
      // Check whether another fork occupies
      // the same area.
      const overlappingFork =
        forkRanges.find(
          (fork) =>
            gateIndex <= fork.end &&
            rejoinIndex >= fork.start
        )

      // If there is an overlapping fork,
      // put the shortcut on the opposite side.
      let shortcutSide =
        overlappingFork
          ? overlappingFork.side ===
            'left'
            ? 'right'
            : 'left'
          : gateIndex % 2 === 0
            ? 'right'
            : 'left'

      // Shortcut gets an even wider dedicated lane.
      const laneX =
        createOutsideLane(
          gateIndex,
          rejoinIndex,
          shortcutSide,
          90
        )

      makeBranch(
        board.shortcut.shortcutPath,
        board.shortcut.gateId,
        board.shortcut.rejoinId,
        laneX
      )
    }
  }

  // --------------------------------
  // BOARD BOUNDS
  // --------------------------------

  const allPositions =
    Object.values(positions)

  const padding = 150

  const minX =
    Math.min(
      ...allPositions.map(
        (point) => point.x
      )
    ) - padding

  const maxX =
    Math.max(
      ...allPositions.map(
        (point) => point.x
      )
    ) + padding

  const minY =
    Math.min(
      ...allPositions.map(
        (point) => point.y
      )
    ) - padding

  const maxY =
    Math.max(
      ...allPositions.map(
        (point) => point.y
      )
    ) + padding

  return {
    positions,
    edgeRoutes,

    bounds: {
      minX,
      maxX,
      minY,
      maxY,

      width: maxX - minX,
      height: maxY - minY,
    },
  }
}